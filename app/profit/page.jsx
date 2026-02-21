"use client";
import SideBar from "@/components/SideBar/page";
import styles from "./styles.module.css";
import { db } from "@/app/firebase";
import { useEffect, useState, useMemo, useCallback } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  Timestamp,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import Loader from "@/components/Loader/Loader";
import {
  NotificationProvider,
  useNotification,
} from "@/contexts/NotificationContext";
import { PERMISSIONS } from "@/constants/config";
import ConfirmModal from "@/components/Main/Modals/ConfirmModal";

function ProfitContent() {
  const { success, error: showError, warning } = useNotification();
  const [shop, setShop] = useState("");
  const [userName, setUserName] = useState("");
  const [resetAt, setResetAt] = useState(null);
  const [reports, setReports] = useState([]);
  const [withdraws, setWithdraws] = useState([]);
  const [dailyProfitData, setDailyProfitData] = useState([]);
  const [cashTotal, setCashTotal] = useState(0);
  const [profit, setProfit] = useState(0);
  const [grossProfit, setGrossProfit] = useState(0);
  const [netProfit, setNetProfit] = useState(0);
  const [mostafaBalance, setMostafaBalance] = useState(0);
  const [doubleMBalance, setDoubleMBalance] = useState(0);
  const [midoBalance, setMidoBalance] = useState(0);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isHidden, setIsHidden] = useState(true);
  const [loading, setLoading] = useState(true);
  const [operationalCashTotal, setOperationalCashTotal] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);
  const [canViewProfit, setCanViewProfit] = useState(false);

  const [showPopup, setShowPopup] = useState(false);
  const [withdrawPerson, setWithdrawPerson] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNotes, setWithdrawNotes] = useState("");
  const [affectNetProfit, setAffectNetProfit] = useState(false);
  const [showPayPopup, setShowPayPopup] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payPerson, setPayPerson] = useState("");
  const [payWithdrawId, setPayWithdrawId] = useState(null);
  const [showAddCashPopup, setShowAddCashPopup] = useState(false);
  const [addCashAmount, setAddCashAmount] = useState("");
  const [addCashNotes, setAddCashNotes] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const router = useRouter();

  // Get shop and hidden state
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedShop = localStorage.getItem("shop") || "";
      const storedUser = localStorage.getItem("userName") || "";
      setShop(storedShop);
      setUserName(storedUser);

      const savedHiddenState = localStorage.getItem("hideFinance");
      if (savedHiddenState !== null) setIsHidden(savedHiddenState === "true");
      const savedReset = localStorage.getItem("resetAt");
      if (savedReset) setResetAt(new Date(savedReset));

      const hasAccess = PERMISSIONS.VIEW_PROFIT(storedUser);
      if (!storedUser || !hasAccess) {
        showError("ليس لديك الصلاحية للوصول إلى صفحة الأرباح❌");
        router.push("/");
      } else {
        setCanViewProfit(true);
      }
      setAuthChecked(true);
    }
  }, [router, showError]);

  // Helper functions
  const arabicToEnglishNumbers = useCallback((str) => {
    if (!str) return str;
    const map = {
      "٠": "0",
      "١": "1",
      "٢": "2",
      "٣": "3",
      "٤": "4",
      "٥": "5",
      "٦": "6",
      "٧": "7",
      "٨": "8",
      "٩": "9",
    };
    return str.replace(/[٠-٩]/g, (d) => map[d]);
  }, []);

  const parseDate = useCallback(
    (val) => {
      if (!val) return null;
      if (val instanceof Date) return val;
      if (val?.toDate) return val.toDate();
      if (val?.seconds) return new Date(val.seconds * 1000);

      if (typeof val === "string") {
        const normalized = arabicToEnglishNumbers(val.trim());
        const dmyMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dmyMatch) {
          const [, d, m, y] = dmyMatch;
          return new Date(Number(y), Number(m) - 1, Number(d));
        }
        const isoMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (isoMatch) {
          const [, y, m, d] = isoMatch;
          return new Date(Number(y), Number(m) - 1, Number(d));
        }
        const tryDate = new Date(normalized);
        if (!isNaN(tryDate.getTime())) return tryDate;
      }
      return null;
    },
    [arabicToEnglishNumbers]
  );

  const formatDate = useCallback((date) => {
    if (!date) return "—";
    const d = date.getDate().toString().padStart(2, "0");
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  }, []);

  // Fetch reset data
  const fetchReset = useCallback(async () => {
    if (!shop) return;

    try {
      const resetSnap = await getDocs(
        query(collection(db, "reset"), where("shop", "==", shop))
      );
      const resets = resetSnap.docs.map((doc) => doc.data());

      if (resets.length > 0) {
        const latestReset = resets.reduce((prev, curr) => {
          const prevTs = prev.resetAt?.seconds
            ? prev.resetAt.seconds
            : new Date(prev.resetAt).getTime() / 1000;
          const currTs = curr.resetAt?.seconds
            ? curr.resetAt.seconds
            : new Date(curr.resetAt).getTime() / 1000;
          return prevTs > currTs ? prev : curr;
        });
        const val = latestReset.resetAt;
        setResetAt(val?.toDate ? val.toDate() : new Date(val));
      }
    } catch (error) {
      console.error("Error fetching reset:", error);
      showError("حدث خطأ أثناء جلب بيانات التصفير");
    }
  }, [shop, showError]);

  // Initial fetch
  useEffect(() => {
    if (!shop) return;
    fetchReset();
  }, [shop, fetchReset]);

  // Real-time updates
  useEffect(() => {
    if (!shop) return;

    const unsubscribeReports = onSnapshot(
      query(collection(db, "reports"), where("shop", "==", shop)),
      (snapshot) => {
        setReports(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (error) => {
        console.error("Error in reports subscription:", error);
        showError("حدث خطأ أثناء تحديث التقارير");
      }
    );

    const unsubscribeWithdraws = onSnapshot(
      query(collection(db, "withdraws"), where("shop", "==", shop)),
      (snapshot) => {
        setWithdraws(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
        setLoading(false);
      },
      (error) => {
        console.error("Error in withdraws subscription:", error);
        showError("حدث خطأ أثناء تحديث السحوبات");
      }
    );

    const unsubscribeDailyProfit = onSnapshot(
      query(collection(db, "dailyProfit"), where("shop", "==", shop)),
      (snapshot) => {
        setDailyProfitData(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
        setLoading(false);
      },
      (error) => {
        console.error("Error in dailyProfit subscription:", error);
        showError("حدث خطأ أثناء تحديث الأرباح اليومية");
      }
    );

    return () => {
      unsubscribeReports();
      unsubscribeWithdraws();
      unsubscribeDailyProfit();
    };
  }, [shop, showError]);

  // Calculate totals with useMemo
  const calculatedTotals = useMemo(() => {
    if (!shop)
      return { 
        cashTotal: 0, 
        profit: 0, 
        grossProfit: 0,
        netProfit: 0,
        mostafa: 0, 
        doubleM: 0,
        mido: 0,
        operationalCashTotal: 0,
      };

    const from = dateFrom
      ? new Date(dateFrom + "T00:00:00")
      : new Date("1970-01-01");
    const to = dateTo ? new Date(dateTo + "T23:59:59") : new Date();

    const isUsingDateFilter = Boolean(dateFrom || dateTo);
    const effectiveFrom = isUsingDateFilter ? from : resetAt || from;

    // بيانات الكاش (الخزنة) تعتمد فقط على فلتر التاريخ ولا تتأثر بالتصفير resetAt
    const dailyForCash = dailyProfitData.filter((d) => {
      const dDate = parseDate(d.date) || parseDate(d.createdAt);
      return dDate && dDate >= from && dDate <= to;
    });

    // بيانات الأرباح (لصافي الربح) تتأثر بالتصفير resetAt
    const dailyForProfit = dailyProfitData.filter((d) => {
      const dDate = parseDate(d.date) || parseDate(d.createdAt);
      return dDate && dDate >= effectiveFrom && dDate <= to;
    });

    // بيانات الأرباح والأرصدة (مصطفى/ميدو/دبل M) تبدأ من resetAt في حالة عدم وجود فلتر تاريخ
    const filteredReports = reports.filter((r) => {
      // نفضل createdAt لأن resetAt فيه الوقت، وليس اليوم فقط
      const rDate = parseDate(r.createdAt) || parseDate(r.date);
      return rDate && rDate >= effectiveFrom && rDate <= to;
    });

    const withdrawsForProfit = withdraws.filter((w) => {
      // نفضل createdAt لنضمن أن السحوبات بعد لحظة التصفير في نفس اليوم تُحتسب
      const wDate = parseDate(w.createdAt) || parseDate(w.date);
      return wDate && wDate >= effectiveFrom && wDate <= to;
    });

    // مصروفات اليوم من dailyProfit.totalMasrofat الخاصة بالخزنة
    const totalMasrofatFromDailyForCash = dailyForCash.reduce(
      (sum, d) => sum + Number(d.totalMasrofat || 0),
      0
    );
    const totalCash = dailyForCash.reduce((sum, d) => {
      const sales = Number(d.totalSales || 0);
      if (d.type === "سداد") {
        return sum - sales;
      }
      return sum + sales;
    }, 0);

    // الخزنة = إجمالي المبيعات - مصاريف dailyProfit.totalMasrofat
    let remainingCash = totalCash - totalMasrofatFromDailyForCash;

    // معاملات السحب/الإيداع التي تؤثر على الخزنة تعتمد فقط على فلتر التاريخ
    const withdrawsForCash = withdraws.filter((w) => {
      const wDate = parseDate(w.date) || parseDate(w.createdAt);
      return wDate && wDate >= from && wDate <= to;
    });

    withdrawsForCash.forEach((w) => {
      const remaining = Number(w.amount || 0) - Number(w.paid || 0);
      if (w.person === "الخزنة") {
        remainingCash += remaining;
      } else {
        remainingCash -= remaining;
      }
    });

    // حساب الربح الإجمالي = إجمالي بيع الفواتير (total sales)
    let grossProfitValue = 0;
    filteredReports.forEach((r) => {
      // استخدام total من الفاتورة مباشرة
      const reportTotal = Number(r.total || 0);
      grossProfitValue += reportTotal;
    });

    // حساب الربح = مجموع أرباح كل فاتورة من reports
    let profitValue = 0;
    filteredReports.forEach((r) => {
      // استخدام profit من الفاتورة مباشرة
      const reportProfit = Number(r.profit || 0);
      profitValue += reportProfit;
    });

    // مصروفات اليوم من dailyProfit.totalMasrofat الخاصة بصافي الربح (تتأثر بالتصفير)
    const totalMasrofatFromDailyForProfit = dailyForProfit.reduce(
      (sum, d) => sum + Number(d.totalMasrofat || 0),
      0
    );

    // حساب السحوبات التي تؤثر على صافي الربح
    const withdrawsAffectingNetProfit = withdrawsForProfit.filter((w) => {
      return w.affectNetProfit === true && w.person !== "الخزنة";
    });
    
    const totalWithdrawsAffectingNetProfit = withdrawsAffectingNetProfit.reduce(
      (sum, w) => {
        const remaining = Number(w.amount || 0) - Number(w.paid || 0);
        return sum + remaining;
      },
      0
    );

    // حساب صافي الربح = مجموع أرباح الفواتير - (مصروفات dailyProfit من بعد resetAt + السحوبات التي تؤثر على صافي الربح)
    const netProfitValue =
      profitValue - totalMasrofatFromDailyForProfit - totalWithdrawsAffectingNetProfit;

    let mostafaSum = 0;
    let doubleMSum = 0;
    let midoSum = 0;

    // أرصدة الشركاء تتأثر بالتصفير resetAt
    withdrawsForProfit.forEach((w) => {
      const remaining = Number(w.amount || 0) - Number(w.paid || 0);
      if (w.person === "مصطفى") mostafaSum += remaining;
      if (w.person === "دبل M") doubleMSum += remaining;
      if (w.person === "ميدو") midoSum += remaining;
    });

    // حساب الخزنة التشغيلية (بدون تأثير فلتر التاريخ وبدون علاقة بالتصفير)
    const operationalFrom = new Date("1970-01-01");
    const operationalTo = new Date();

    const operationalDailyForCash = dailyProfitData.filter((d) => {
      const dDate = parseDate(d.date) || parseDate(d.createdAt);
      return dDate && dDate >= operationalFrom && dDate <= operationalTo;
    });

    const operationalTotalMasrofatDaily = operationalDailyForCash.reduce(
      (sum, d) => sum + Number(d.totalMasrofat || 0),
      0
    );

    const operationalTotalMasrofatCombined =
      operationalTotalMasrofatDaily;

    const operationalTotalCash = operationalDailyForCash.reduce((sum, d) => {
      const sales = Number(d.totalSales || 0);
      if (d.type === "سداد") {
        return sum - sales;
      }
      return sum + sales;
    }, 0);

    const operationalRemainingCash =
      operationalTotalCash - operationalTotalMasrofatCombined;

    if (
      process.env.NODE_ENV !== "production" &&
      (remainingCash < 0 ||
        netProfitValue < 0 ||
        mostafaSum < 0 ||
        doubleMSum < 0 ||
        midoSum < 0)
    ) {
      console.warn("[Profit] Negative financial value detected", {
        remainingCash,
        netProfitValue,
        mostafaSum,
        doubleMSum,
        midoSum,
      });
    }

    return {
      cashTotal: remainingCash,
      profit: profitValue, // الربح = مجموع أرباح كل فاتورة
      grossProfit: grossProfitValue,
      netProfit: netProfitValue, // صافي الربح = مجموع أرباح الفواتير - المصروفات (بدون فاتورة مرتجع) - السحوبات التي تؤثر على صافي الربح
      mostafa: mostafaSum,
      doubleM: doubleMSum,
      mido: midoSum,
      operationalCashTotal: operationalRemainingCash,
    };
  }, [
    dateFrom,
    dateTo,
    dailyProfitData,
    reports,
    withdraws,
    shop,
    resetAt,
    parseDate,
  ]);

  useEffect(() => {
    setCashTotal(calculatedTotals.cashTotal);
    setProfit(calculatedTotals.profit);
    setGrossProfit(calculatedTotals.grossProfit);
    setNetProfit(calculatedTotals.netProfit);
    setMostafaBalance(calculatedTotals.mostafa);
    setDoubleMBalance(calculatedTotals.doubleM);
    setMidoBalance(calculatedTotals.mido);
    setOperationalCashTotal(calculatedTotals.operationalCashTotal);
  }, [calculatedTotals]);

  const toggleHidden = useCallback(() => {
    setIsHidden((prev) => {
      const newState = !prev;
      localStorage.setItem("hideFinance", String(newState));
      return newState;
    });
  }, []);

  const handleWithdraw = useCallback(async () => {
    if (!withdrawPerson || !withdrawAmount) {
      showError("اختر الشخص واكتب المبلغ");
      return;
    }
    const amount = Number(withdrawAmount);
    if (amount <= 0) {
      showError("المبلغ غير صالح");
      return;
    }
    // التحقق من رصيد الخزنة الحالي الظاهر للمستخدم فقط
    if (amount > cashTotal) {
      showError("رصيد الخزنة غير كافي");
      return;
    }

    setIsProcessing(true);
    try {
      const newDate = new Date();
      await addDoc(collection(db, "withdraws"), {
        shop,
        person: withdrawPerson,
        amount,
        notes: withdrawNotes,
        date: formatDate(newDate),
        createdAt: Timestamp.fromDate(newDate),
        paid: 0,
        affectNetProfit: affectNetProfit,
      });

      success("✅ تم إضافة السحب بنجاح");
      setWithdrawPerson("");
      setWithdrawAmount("");
      setWithdrawNotes("");
      setAffectNetProfit(false);
      setShowPopup(false);
    } catch (error) {
      console.error("Error adding withdraw:", error);
      showError("حدث خطأ أثناء إضافة السحب");
    } finally {
      setIsProcessing(false);
    }
  }, [
    withdrawPerson,
    withdrawAmount,
    withdrawNotes,
    affectNetProfit,
    cashTotal,
    shop,
    formatDate,
    success,
    showError,
  ]);

  const handleAddCash = useCallback(async () => {
    const amount = Number(addCashAmount);
    if (!amount || amount <= 0) {
      showError("ادخل مبلغ صالح");
      return;
    }

    setIsProcessing(true);
    try {
      const newDate = new Date();
      await addDoc(collection(db, "withdraws"), {
        shop,
        person: "الخزنة",
        amount,
        paid: 0,
        notes: addCashNotes,
        date: formatDate(newDate),
        createdAt: Timestamp.fromDate(newDate),
      });

      success("✅ تم إضافة المبلغ للخزنة بنجاح");
      setAddCashAmount("");
      setAddCashNotes("");
      setShowAddCashPopup(false);
    } catch (error) {
      console.error("Error adding cash:", error);
      showError("حدث خطأ أثناء إضافة المبلغ");
    } finally {
      setIsProcessing(false);
    }
  }, [addCashAmount, addCashNotes, shop, formatDate, success, showError]);

  const handleResetProfit = useCallback(async () => {
    setIsProcessing(true);
    try {
      const now = Timestamp.now();
      await addDoc(collection(db, "reset"), {
        shop,
        resetAt: now,
      });

      const nowDate = new Date();
      localStorage.setItem("resetAt", nowDate.toISOString());
      setResetAt(nowDate);
      success("✅ تم تصفير الأرباح والأرصدة بنجاح");
      setShowResetConfirm(false);
    } catch (error) {
      console.error("Error resetting profit:", error);
      showError("حدث خطأ أثناء تصفير الأرباح");
    } finally {
      setIsProcessing(false);
    }
  }, [shop, success, showError]);

  const handleDeleteWithdraw = useCallback(
    async (id) => {
      if (!id) return;

      setIsProcessing(true);
      try {
        await deleteDoc(doc(db, "withdraws", id));
        success("✅ تم حذف السحب بنجاح");
      } catch (error) {
        console.error("Error deleting withdraw:", error);
        showError("حدث خطأ أثناء حذف السحب");
      } finally {
        setIsProcessing(false);
      }
    },
    [success, showError]
  );

  const handleOpenPay = useCallback((withdraw) => {
    setPayWithdrawId(withdraw.id);
    setPayPerson(withdraw.person);
    setPayAmount("");
    setShowPayPopup(true);
  }, []);

  const handlePay = useCallback(async () => {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      showError("ادخل مبلغ صالح");
      return;
    }

    const withdraw = withdraws.find((w) => w.id === payWithdrawId);
    if (!withdraw) {
      showError("حدث خطأ");
      return;
    }

    const remainingDebt = withdraw.amount - (withdraw.paid || 0);
    if (amount > remainingDebt) {
      showError(`المبلغ أكبر من المبلغ المستحق: ${remainingDebt}`);
      return;
    }

    setIsProcessing(true);
    try {
      const withdrawRef = doc(db, "withdraws", payWithdrawId);
      await updateDoc(withdrawRef, { paid: (withdraw.paid || 0) + amount });
      success("✅ تم السداد بنجاح");
      setShowPayPopup(false);
    } catch (error) {
      console.error("Error paying withdraw:", error);
      showError("حدث خطأ أثناء السداد");
    } finally {
      setIsProcessing(false);
    }
  }, [payAmount, payWithdrawId, withdraws, success, showError]);

  const filteredWithdraws = useMemo(() => {
    const filtered = withdraws.filter((w) => {
      if (!dateFrom && !dateTo) return true;
      const wDate = parseDate(w.date) || parseDate(w.createdAt);
      if (!wDate) return false;
      const from = dateFrom
        ? new Date(dateFrom + "T00:00:00")
        : new Date("1970-01-01");
      const to = dateTo ? new Date(dateTo + "T23:59:59") : new Date();
      return wDate >= from && wDate <= to;
    });

    // ترتيب حسب التاريخ (الأحدث أولاً)
    return filtered.sort((a, b) => {
      const dateA = parseDate(a.date) || parseDate(a.createdAt);
      const dateB = parseDate(b.date) || parseDate(b.createdAt);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateB.getTime() - dateA.getTime(); // ترتيب تنازلي (الأحدث أولاً)
    });
  }, [withdraws, dateFrom, dateTo, parseDate]);

  if (!authChecked) {
    return <Loader />;
  }

  if (!canViewProfit) {
    return null;
  }

  if (loading && reports.length === 0 && withdraws.length === 0) {
    return <Loader />;
  }

  return (
    <div className={styles.profit}>
      <SideBar />

      <div className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>الأرباح</h2>
          <div className={styles.headerActions}>
            <button onClick={toggleHidden} className={styles.toggleBtn}>
              {isHidden ? "إظهار الأرقام" : "إخفاء الأرقام"}
            </button>
            <button
              onClick={() => setShowResetConfirm(true)}
              className={styles.resetBtn}
            >
              تصفير الأرباح
            </button>
          </div>
        </div>

        {/* Date Filters */}
        <div className={styles.searchBox}>
          <div className={styles.inputContainer}>
            <label className={styles.dateLabel}>من تاريخ:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={styles.dateInput}
            />
          </div>
          <div className={styles.inputContainer}>
            <label className={styles.dateLabel}>إلى تاريخ:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={styles.dateInput}
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className={styles.summaryCards}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>الخزنة</span>
            <span className={styles.summaryValue}>
              {isHidden ? "*****" : Number(cashTotal || 0).toFixed(2)} EGP
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>الربح</span>
            <span className={styles.summaryValue}>
              {isHidden ? "*****" : Number(profit || 0).toFixed(2)} EGP
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>صافي الربح</span>
            <span className={styles.summaryValue}>
              {isHidden ? "*****" : Number(netProfit || 0).toFixed(2)} EGP
            </span>
          </div>
        </div>
        <div className={styles.summaryCards}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>مصطفى</span>
            <span className={styles.summaryValue}>
              {isHidden ? "*****" : Number(mostafaBalance || 0).toFixed(2)} EGP
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>دبل M</span>
            <span className={styles.summaryValue}>
              {isHidden ? "*****" : Number(doubleMBalance || 0).toFixed(2)} EGP
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>ميدو</span>
            <span className={styles.summaryValue}>
              {isHidden ? "*****" : Number(midoBalance || 0).toFixed(2)} EGP
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={styles.actionButtons}>
          <button
            onClick={() => setShowPopup(true)}
            className={styles.withdrawBtn}
          >
            سحب
          </button>
          <button
            onClick={() => setShowAddCashPopup(true)}
            className={styles.addCashBtn}
          >
            إضافة للخزنة
          </button>
        </div>

        {/* Table */}
        <div className={styles.tableWrapper}>
          <table className={styles.profitTable}>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>المبلغ</th>
                <th>المدفوع</th>
                <th>المتبقي</th>
                <th>التاريخ</th>
                <th>ملاحظات</th>
                <th>حذف</th>
                <th>سداد</th>
              </tr>
            </thead>
            <tbody>
              {filteredWithdraws.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.emptyCell}>
                    <div className={styles.emptyState}>
                      <p>❌ لا توجد سحوبات في الفترة المحددة</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredWithdraws.map((w) => {
                  const totalAmount = Number(w.amount || 0);
                  const paidAmount = Number(w.paid || 0);
                  const remaining = totalAmount - paidAmount;
                  return (
                    <tr key={w.id}>
                      <td className={styles.nameCell}>{w.person}</td>
                      <td className={styles.amountCell}>
                        {isHidden ? "*****" : totalAmount.toFixed(2)} EGP
                      </td>
                      <td className={styles.paidCell}>
                        {isHidden ? "*****" : paidAmount.toFixed(2)} EGP
                      </td>
                      <td className={styles.remainingCell}>
                        {isHidden ? "*****" : remaining.toFixed(2)} EGP
                      </td>
                      <td className={styles.dateCell}>
                        {formatDate(
                          parseDate(w.date) || parseDate(w.createdAt)
                        )}
                      </td>
                      <td className={styles.notesCell}>{w.notes || "-"}</td>
                      <td className={styles.actionsCell}>
                        {remaining > 0 && (
                          <button
                            className={styles.delBtn}
                            onClick={() => handleDeleteWithdraw(w.id)}
                            disabled={isProcessing}
                          >
                            حذف
                          </button>
                        )}
                      </td>
                      <td className={styles.actionsCell}>
                        {remaining > 0 && w.person !== "الخزنة" && (
                          <button
                            className={styles.payBtn}
                            onClick={() => handleOpenPay(w)}
                            disabled={isProcessing}
                          >
                            سداد
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Withdraw Modal */}
      {showPopup && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowPopup(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>عملية سحب</h3>
              <button
                className={styles.closeBtn}
                onClick={() => setShowPopup(false)}
              >
                ×
              </button>
            </div>
            <div className={styles.modalContent}>
              <div className={styles.inputContainer}>
                <label>اختر الشخص:</label>
                <select
                  value={withdrawPerson}
                  onChange={(e) => setWithdrawPerson(e.target.value)}
                  className={styles.selectInput}
                >
                  <option value="">اختر الشخص</option>
                  <option value="مصطفى">مصطفى</option>
                  <option value="دبل M">دبل M</option>
                  <option value="ميدو">ميدو</option>
                </select>
              </div>
              <div className={styles.inputContainer}>
                <label>المبلغ:</label>
                <input
                  type="number"
                  placeholder="المبلغ"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className={styles.modalInput}
                />
              </div>
              <div className={styles.inputContainer}>
                <label>ملاحظات:</label>
                <input
                  type="text"
                  placeholder="ملاحظات"
                  value={withdrawNotes}
                  onChange={(e) => setWithdrawNotes(e.target.value)}
                  className={styles.modalInput}
                />
              </div>
              <div className={styles.inputContainer}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={affectNetProfit}
                    onChange={(e) => setAffectNetProfit(e.target.checked)}
                    style={{ width: "18px", height: "18px", cursor: "pointer" }}
                  />
                  <span>ينقص من صافي الربح</span>
                </label>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button
                onClick={handleWithdraw}
                className={styles.confirmBtn}
                disabled={isProcessing}
              >
                {isProcessing ? "جاري المعالجة..." : "تأكيد"}
              </button>
              <button
                onClick={() => setShowPopup(false)}
                className={styles.cancelBtn}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Cash Modal */}
      {showAddCashPopup && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowAddCashPopup(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>إضافة مبلغ للخزنة</h3>
              <button
                className={styles.closeBtn}
                onClick={() => setShowAddCashPopup(false)}
              >
                ×
              </button>
            </div>
            <div className={styles.modalContent}>
              <div className={styles.inputContainer}>
                <label>المبلغ:</label>
                <input
                  type="number"
                  placeholder="المبلغ"
                  value={addCashAmount}
                  onChange={(e) => setAddCashAmount(e.target.value)}
                  className={styles.modalInput}
                />
              </div>
              <div className={styles.inputContainer}>
                <label>ملاحظات:</label>
                <input
                  type="text"
                  placeholder="ملاحظات"
                  value={addCashNotes}
                  onChange={(e) => setAddCashNotes(e.target.value)}
                  className={styles.modalInput}
                />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button
                onClick={handleAddCash}
                className={styles.confirmBtn}
                disabled={isProcessing}
              >
                {isProcessing ? "جاري المعالجة..." : "تأكيد"}
              </button>
              <button
                onClick={() => setShowAddCashPopup(false)}
                className={styles.cancelBtn}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Modal */}
      {showPayPopup && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowPayPopup(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>سداد مبلغ</h3>
              <button
                className={styles.closeBtn}
                onClick={() => setShowPayPopup(false)}
              >
                ×
              </button>
            </div>
            <div className={styles.modalContent}>
              <div className={styles.editInfo}>
                <p>
                  <strong>الشخص:</strong> {payPerson}
                </p>
              </div>
              <div className={styles.inputContainer}>
                <label>المبلغ:</label>
                <input
                  type="number"
                  placeholder="المبلغ"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className={styles.modalInput}
                />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button
                onClick={handlePay}
                className={styles.confirmBtn}
                disabled={isProcessing}
              >
                {isProcessing ? "جاري المعالجة..." : "تأكيد"}
              </button>
              <button
                onClick={() => setShowPayPopup(false)}
                className={styles.cancelBtn}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirm Modal */}
      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title="تأكيد التصفير"
        message="هل أنت متأكد من تصفير الأرباح والأرصدة؟"
        onConfirm={handleResetProfit}
        confirmText="تأكيد التصفير"
        cancelText="إلغاء"
        type="warning"
      />
    </div>
  );
}

export default function Profit() {
  return (
    <NotificationProvider>
      <ProfitContent />
    </NotificationProvider>
  );
}
