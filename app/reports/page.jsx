  'use client';
  import SideBar from "@/components/SideBar/page";
  import styles from "./styles.module.css";
  import { useState, useEffect } from "react";
  import {
    collection,
    query,
    where,
    onSnapshot,
    getDocs,
    addDoc,
    doc,
    updateDoc,
    getDoc,
    deleteDoc,
    Timestamp
  } from "firebase/firestore";
  import { db } from "@/app/firebase";
  import * as XLSX from "xlsx";
  import { saveAs } from "file-saver";
  import { useRouter } from "next/navigation";

  function Reports() {
    const router = useRouter()
    const [fromDate, setFromDate] = useState("");
    const [showDeleted, setShowDeleted] = useState(false);
    const [deletedProducts, setDeletedProducts] = useState([]);
    const [toDate, setToDate] = useState("");
    const [filterType, setFilterType] = useState("all");
    const [reports, setReports] = useState([]);
    const [displayedReports, setDisplayedReports] = useState([]); 
    const [totalAmount, setTotalAmount] = useState(0);
    const [masrofatList, setMasrofatList] = useState([]);
    const [expensesInRange, setExpensesInRange] = useState(0);
    const [profitInRange, setProfitInRange] = useState(0);
    const [searchPhone, setSearchPhone] = useState("");
    const [searchInvoiceNumber, setSearchInvoiceNumber] = useState(""); // NEW: search by invoice number
    const [selectedReport, setSelectedReport] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [auth, setAuth] = useState(false)
    const [loading, setLoading] = useState(true)
    const [showReturns, setShowReturns] = useState(false)
    const [returnsList, setReturnsList] = useState([])
    const shop = typeof window !== "undefined" ? localStorage.getItem("shop") : "";


    useEffect(() => {
      const checkLock = async() => {
        const userName = localStorage.getItem('userName')
        if(!userName) {
          router.push('/')
          return
        }
        const q = query(collection(db, 'users'), where('userName', '==', userName))
        const querySnapshot = await getDocs(q)
        if(!querySnapshot.empty) {
          const user = querySnapshot.docs[0].data()
          if(user.permissions?.reports === true) {
            alert('ليس ليدك الصلاحية للوصول الى هذه الصفحة❌')
            router.push('/')
            return
          }else {
            setAuth(true)
          }
        }else {
          router.push('/')
          return
        }
        setLoading(false)
      }
      checkLock()
    }, [])

    // Helper: convert Firestore timestamp OR Arabic date string to milliseconds
    const toMillis = (dateField) => {
      if (!dateField) return null;

      // Firestore Timestamp object
      if (typeof dateField === "object" && dateField.seconds) {
        return dateField.seconds * 1000;
      }

      if (typeof dateField === "string") {
        try {
          // نحول الأرقام الهندية العربية إلى أرقام عادية
          const normalized = dateField.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
          // نقسم اليوم/الشهر/السنة
          const parts = normalized.split("/").map((p) => p.replace(/[^\d]/g, ""));
          if (parts.length === 3) {
            const [day, month, year] = parts.map(Number);
            const d = new Date(year, month - 1, day);
            if (!isNaN(d.getTime())) return d.getTime();
          }
        } catch {
          return null;
        }
      }

      // محاولة أخيرة مع Date مباشرة
      const d = new Date(dateField);
      return isNaN(d.getTime()) ? null : d.getTime();
    };

    useEffect(() => {
  if (!shop) return;
  const q = query(collection(db, "deletedProducts"), where("shop", "==", shop));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    setDeletedProducts(all);
  });
  return () => unsubscribe();
}, [shop]);


    // fetch all reports for the shop
    useEffect(() => {
      if (!shop) return;
      const q = query(collection(db, "reports"), where("shop", "==", shop));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const allReports = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setReports(allReports);
      });
      return () => unsubscribe();
    }, [shop]);

    // fetch all masrofat
    useEffect(() => {
      if (!shop) return;
      const q = query(collection(db, "masrofat"), where("shop", "==", shop));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMasrofatList(all);
      });
      return () => unsubscribe();
    }, [shop]);

    // fetch all returns
    useEffect(() => {
      if (!shop) return;
      const q = query(collection(db, "returns"), where("shop", "==", shop));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setReturnsList(all);
      });
      return () => unsubscribe();
    }, [shop]);

    const sumColorsQty = (colors = []) => colors.reduce((s, c) => s + (Number(c.quantity || 0)), 0);
    const sumSizesQty = (sizes = []) => sizes.reduce((s, c) => s + (Number(c.quantity || 0)), 0);
    const computeNewTotalQuantity = (colors, sizes, fallbackOldQuantity = 0) => {
      const cSum = Array.isArray(colors) ? sumColorsQty(colors) : 0;
      const sSum = Array.isArray(sizes) ? sumSizesQty(sizes) : 0;
      if (cSum > 0 && sSum > 0) {
        return Math.max(cSum, sSum);
      }
      if (cSum > 0) return cSum;
      if (sSum > 0) return sSum;
      return fallbackOldQuantity;
    };

    // compute displayedReports
    useEffect(() => {
      // If user is searching by invoice number, bypass date requirement and filter by invoiceNumber
      if (searchInvoiceNumber?.trim()) {
        const qStr = searchInvoiceNumber.trim();
        const filteredByInvoice = reports
          .filter(r => {
            const invNum = (r.invoiceNumber !== undefined && r.invoiceNumber !== null) ? String(r.invoiceNumber) : "";
            return invNum.includes(qStr);
          })
          // still apply phone search and type filter
          .map((report) => {
            if (filterType === "all") return report;
            return { ...report, cart: report.cart?.filter((item) => item.type === filterType) || [] };
          })
          .filter((report) => (report.cart?.length ?? 0) > 0 && (searchPhone.trim() ? (report.phone?.toString().includes(searchPhone.trim())) : true));

        // compute totals for this filtered set
        let totalSales = 0;
        let totalProfit = 0;
        filteredByInvoice.forEach((report) => {
          const cart = report.cart || [];
          const cartTotal = cart.reduce((s, it) => s + (Number(it.sellPrice || 0) * Number(it.quantity || 0)), 0);
          const reportTotal = Number(report.total ?? (cartTotal - (Number(report.discount || 0))));
          totalSales += reportTotal;
          let reportProfit = 0;
          const discountValue = Number(report.discount || 0);
          cart.forEach((it) => {
            const qty = Number(it.quantity || 0);
            const sell = Number(it.sellPrice || 0);
            const buy = Number(it.buyPrice ?? it.productPrice ?? 0);
            const itemGross = sell * qty;
            const itemDiscount = cartTotal > 0 ? (itemGross / cartTotal) * discountValue : 0;
            const itemNetRevenue = itemGross - itemDiscount;
            const itemProfit = itemNetRevenue - (buy * qty);
            reportProfit += itemProfit;
          });
          totalProfit += reportProfit;
        });

        setDisplayedReports(filteredByInvoice);
        setTotalAmount(totalSales);
        // expenses should still come from masrofat within date range — but since invoice search bypasses date filter,
        // we will set expenses to 0 (or you can choose to compute across all masrofat matching shop).
        setExpensesInRange(0);
        setProfitInRange(totalProfit);
        return;
      }

      // Normal behavior: require both fromDate and toDate
      if (!fromDate || !toDate) {
        setDisplayedReports([]);
        setTotalAmount(0);
        setExpensesInRange(0);
        setProfitInRange(0);
        return;
      }

      let from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      const fromMs = from.getTime();
      let to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      const toMs = to.getTime();

      let filtered = reports.filter((report) => {
        const repMs = toMillis(report.date);
        if (!repMs) return false;
        return repMs >= fromMs && repMs <= toMs;
      });

      if (searchPhone.trim()) {
        filtered = filtered.filter((r) => r.phone?.toString().includes(searchPhone.trim()));
      }

      filtered = filtered
        .map((report) => {
          if (filterType === "all") return report;
          return {
            ...report,
            cart: report.cart?.filter((item) => item.type === filterType) || [],
          };
        })
        .filter((report) => (report.cart?.length ?? 0) > 0);

      let totalSales = 0;
      let totalProfit = 0;

      filtered.forEach((report) => {
        const cart = report.cart || [];
        const cartTotal = cart.reduce((s, it) => s + (Number(it.sellPrice || 0) * Number(it.quantity || 0)), 0);
        const reportTotal = Number(report.total ?? (cartTotal - (Number(report.discount || 0))));
        totalSales += reportTotal;
        let reportProfit = 0;
        const discountValue = Number(report.discount || 0);
        cart.forEach((it) => {
          const qty = Number(it.quantity || 0);
          const sell = Number(it.sellPrice || 0);
          const buy = Number(it.buyPrice ?? it.productPrice ?? 0);
          const itemGross = sell * qty;
          const itemDiscount = cartTotal > 0 ? (itemGross / cartTotal) * discountValue : 0;
          const itemNetRevenue = itemGross - itemDiscount;
          const itemProfit = itemNetRevenue - (buy * qty);
          reportProfit += itemProfit;
        });
        totalProfit += reportProfit;
      });

      const expenses = masrofatList.reduce((s, exp) => {
        const expMs = toMillis(exp.date);
        if (!expMs) return s;
        if (expMs >= fromMs && expMs <= toMs) {
          return s + (Number(exp.masrof || 0));
        }
        return s;
      }, 0);

      setDisplayedReports(filtered);
      setTotalAmount(totalSales);
      setExpensesInRange(expenses);
      setProfitInRange(totalProfit);
    }, [reports, masrofatList, fromDate, toDate, filterType, searchPhone, searchInvoiceNumber]);

    // compute displayedReturns
    const displayedReturns = returnsList.filter((ret) => {
      if (!fromDate || !toDate) {
        // if no date filter, show all returns (or you could return [] if you prefer)
        return true;
      }
      const fromMs = new Date(fromDate).setHours(0, 0, 0, 0);
      const toMs = new Date(toDate).setHours(23, 59, 59, 999);
      const retMs = toMillis(ret.returnDate);
      if (!retMs) return false;
      return retMs >= fromMs && retMs <= toMs;
    });

    // Excel export
    const exportToExcel = async () => {
      if (!fromDate || !toDate) {
        alert("رجاءً اختر فترة (من - إلى) قبل التصدير");
        return;
      }

      const fromTime = new Date(fromDate).setHours(0, 0, 0, 0);
      const toTime = new Date(toDate).setHours(23, 59, 59, 999);

      const exportProducts = [];
      let totalSales = 0;
      let totalProfit = 0;

      displayedReports.forEach((report) => {
        report.cart?.forEach((item) => {
          const itemDate = new Date(report.date.seconds * 1000).getTime();
          if (itemDate >= fromTime && itemDate <= toTime) {
            const itemTotal = item.sellPrice * item.quantity;
            const itemProfit = (item.sellPrice - (item.buyPrice || 0)) * item.quantity;
            totalSales += itemTotal;
            totalProfit += itemProfit;

            exportProducts.push({
              "اسم المنتج": item.name,
              "الكمية": item.quantity,
              "سعر البيع": item.sellPrice,
              "سعر الشراء": item.buyPrice,
              "الربح": itemProfit,
              "الخصم": report.discount ?? 0,
              "اسم العميل": report.clientName,
              "رقم الهاتف": report.phone,
              "الموظف": report.employee,
              "المحل": report.shop,
              "التاريخ": new Date(report.date.seconds * 1000).toLocaleDateString("ar-EG"),
            });
          }
        });
      });

      const expensesSnapshot = await getDocs(collection(db, "masrofat"));
      const exportExpenses = [];
      let totalExpenses = 0;

      expensesSnapshot.forEach((docSnap) => {
        const exp = docSnap.data();
        const dateStr = exp.date;
        if (!dateStr) return;
        const normalized = dateStr.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
        const parts = normalized.split("/").map((p) => p.replace(/[^\d]/g, ""));
        if (parts.length === 3) {
          const [day, month, year] = parts.map(Number);
          const expTime = new Date(year, month - 1, day).getTime();
          if (expTime >= fromTime && expTime <= toTime) {
            totalExpenses += Number(exp.masrof) || 0;
            exportExpenses.push({
              "البيان": exp.reason || "-",
              "القيمة": exp.masrof || 0,
              "التاريخ": exp.date,
              "المحل": exp.shop || "-",
            });
          }
        }
      });

      const debtsSnapshot = await getDocs(collection(db, "debts"));
      const exportDebts = [];
      debtsSnapshot.forEach((docSnap) => {
        const debt = docSnap.data();
        const debtDate = debt.date?.seconds ? new Date(debt.date.seconds * 1000) : null;
        if (!debtDate) return;
        const debtTime = debtDate.getTime();
        if (debtTime >= fromTime && debtTime <= toTime) {
          exportDebts.push({
            "اسم العميل": debt.clientName,
            "المبلغ": debt.amount,
            "التاريخ": debtDate.toLocaleDateString("ar-EG"),
            "المحل": debt.shop || "-",
            "ملاحظات": debt.notes || "-",
          });
        }
      });

      const summaryData = [
        { البند: "إجمالي المبيعات", القيمة: totalSales },
        { البند: "إجمالي المصروفات", القيمة: totalExpenses },
        { البند: "إجمالي الربح", القيمة: totalProfit },
        { البند: "صافي الربح", القيمة: totalProfit - totalExpenses },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportProducts), "Products");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportExpenses), "Expenses");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportDebts), "Debts");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryData), "Summary");

      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const data = new Blob([excelBuffer], { type: "application/octet-stream" });
      saveAs(data, `Reports_${new Date().toLocaleDateString("ar-EG")}.xlsx`);

      alert("✅ تم تصدير الملف بنجاح!");
    };

    // Drawer open/close
    const openDrawer = (report) => {
      setSelectedReport(report);
      setIsDrawerOpen(true);
    };
    const closeDrawer = () => {
      setSelectedReport(null);
      setIsDrawerOpen(false);
    };

    // Handle return
    const handleReturnProduct = async (item, invoiceId) => {
    try {
      const today = new Date();
      const formattedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

      const dailySalesQ = query(collection(db, "dailySales"), where("shop", "==", item.shop));
      const dailySalesSnap = await getDocs(dailySalesQ);
      let totalSales = 0;
      dailySalesSnap.forEach(d => { const data = d.data(); totalSales += Number(data.total || 0); });

      const itemTotalPrice = Number(item.sellPrice || 0) * Number(item.quantity || 0);
      const itemProfit = (Number(item.sellPrice || 0) - Number(item.buyPrice || 0)) * Number(item.quantity || 0);

      if (totalSales < itemTotalPrice) {
        alert("⚠️ لا يمكن إرجاع هذا المنتج لأن إجمالي المبيعات أقل من سعره!");
        return;
      }
      const invoiceRef = doc(db, "reports", invoiceId);
      const invoiceSnap = await getDoc(invoiceRef);

      if (!invoiceSnap.exists()) {
        alert("⚠️ لم يتم العثور على الفاتورة!");
        return;
      }

      const invoiceData = invoiceSnap.data();
      const invoiceDate = invoiceData.date;

      const updatedCart = invoiceData.cart.filter(
        (p) =>
          !(
            p.code === item.code &&
            p.quantity === item.quantity &&
            p.sellPrice === item.sellPrice &&
            p.name === item.name &&
            (p.color || "") === (item.color || "") &&
            (p.size || "") === (item.size || "")
          )
      );

      if (invoiceDate === formattedDate) {
        if (updatedCart.length > 0) {
          const newTotal = updatedCart.reduce((sum, p) => sum + (p.sellPrice * p.quantity || 0), 0);
          const newProfit = updatedCart.reduce((sum, p) => sum + ((p.sellPrice - (p.buyPrice || 0)) * (p.quantity || 1)), 0);

          await updateDoc(invoiceRef, { cart: updatedCart, total: newTotal, profit: newProfit });

          const empQ = query(collection(db, "employeesReports"), where("date", "==", invoiceData.date), where("shop", "==", invoiceData.shop));
          const empSnap = await getDocs(empQ);
          empSnap.forEach(async (d) => {
            await updateDoc(d.ref, { cart: updatedCart, total: newTotal, profit: newProfit });
          });

          alert(`✅ تم إرجاع ${item.name} بنجاح وحُذف من الفاتورة!`);
        } else {
          // الفاتورة أصبحت فارغة => نحذفها
          await deleteDoc(invoiceRef);

          const empQ = query(collection(db, "employeesReports"), where("date", "==", invoiceData.date), where("shop", "==", invoiceData.shop));
          const empSnap = await getDocs(empQ);
          empSnap.forEach(async (d) => {
            await deleteDoc(d.ref);
          });

          alert(`✅ تم إرجاع ${item.name} وحُذفت الفاتورة لأنها أصبحت فارغة.`);
        }

        // أضف سجل المصروف لليوم (كما قبل)
        await addDoc(collection(db, "masrofat"), {
          name: item.name,
          masrof: itemTotalPrice,
          profit: itemProfit,
          reason: "فاتورة مرتجع",
          date: formattedDate,
          shop: item.shop || shop,
        });
      }
      else {
        await addDoc(collection(db, "masrofat"), {
          name: item.name,
          masrof: itemTotalPrice, 
          profit: itemProfit,   
          reason: "فاتورة مرتجع",
          date: formattedDate,
          shop: item.shop || shop,
        });

        await addDoc(collection(db, "employeesReports"), {
          shop: item.shop || shop,
          date: formattedDate,
          cart: [],
          total: 0,
          profit: -itemProfit,
          note: `مرتجع من فاتورة ${invoiceId} (أصلاً بتاريخ ${invoiceDate})`,
          createdAt: Timestamp.now()
        });

        // إعلام المستخدم
        alert(`✅ تم تسجيل مرتجع ${item.name} بتاريخ ${formattedDate} بدون تغيير الفاتورة الأصلية (ستظهر التأثيرات على الربح في يوم المرتجع).`);
      }

      // ✅ إضافة الجزء الخاص بالمرتجع في collection "returns"
      await addDoc(collection(db, "returns"), {
        originalInvoiceId: invoiceId,
        originalDate: invoiceDate || formattedDate,
        returnDate: formattedDate,
        item: item,
        shop: item.shop || shop,
      });

    } catch (error) {
      console.error("خطأ أثناء الإرجاع:", error);
      alert("❌ حدث خطأ أثناء إرجاع المنتج");
    }
  };

    if (loading) return <p>🔄 جاري التحقق...</p>;
    if (!auth) return null;

    return (
      <div className={styles.reports}>
        <SideBar />

        <div className={styles.content}>
          <div className={styles.filterBar}>
            <div className={styles.inputBox}>
              <div className="inputContainer">
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="inputContainer">
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>

            <div className={styles.inputBox}>
              <div className="inputContainer">
                <input type="text" placeholder="بحث برقم العميل" value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} />
              </div>
            </div>

            {/* NEW: بحث برقم الفاتورة */}
            <div className={styles.inputBox} style={{ marginLeft: 12 }}>
              <div className="inputContainer">
                <input
                  type="text"
                  placeholder="بحث برقم الفاتورة (اضغط بدون اختيار تاريخ)"
                  value={searchInvoiceNumber}
                  onChange={(e) => setSearchInvoiceNumber(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div style={{marginTop: '15px'}}>
            <button className={styles.exeBtn} onClick={exportToExcel}>تصدير Excel</button>
            <button className={styles.exeBtn} onClick={() => setShowReturns(!showReturns)} style={{marginRight: '15px'}}>
              {showReturns ? "إخفاء فواتير المرتج" : "عرض فواتير المرتجع"}
            </button>
            <button
              className={styles.exeBtn}
              onClick={() => setShowDeleted(!showDeleted)}
              style={{ marginRight: "15px" }}
            >
              {showDeleted ? "إخفاء المنتجات المحذوفة" : "عرض المنتجات المحذوفة"}
            </button>
          </div>

          {!showReturns && (
            <div className={styles.tableContainer}>
  <table>
    <thead>
      <tr>
        {showDeleted ? (
          <>
            <th>اسم المنتج</th>
            <th>الكمية</th>
            <th>سعر البيع</th>
            <th>تاريخ الحذف</th>
          </>
        ) : showReturns ? (
          <>
            <th>المنتج</th>
            <th>الكمية</th>
            <th>سعر البيع</th>
            <th>تاريخ الفاتورة الأصلية</th>
            <th>تاريخ المرتجع</th>
          </>
        ) : (
          <>
            <th>اسم العميل</th>
            <th>رقم الهاتف</th>
            <th>عدد العناصر</th>
            <th>الإجمالي</th>
            <th>التاريخ</th>
            <th>عرض التفاصيل</th>
          </>
        )}
      </tr>
    </thead>
    <tbody>
      {showDeleted ? (
        deletedProducts.length === 0 ? (
          <tr>
            <td colSpan={4} style={{ textAlign: "center", padding: 20 }}>
              لا توجد منتجات محذوفة.
            </td>
          </tr>
        ) : (
          deletedProducts.map((item) => {
            const delMs = toMillis(item.deletedAt);
            const delDateStr = delMs
              ? new Date(delMs).toLocaleDateString("ar-EG")
              : item.deletedAt || "-";
            return (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.quantity}</td>
                <td>{item.sellPrice}</td>
                <td>{delDateStr}</td>
              </tr>
            );
          })
        )
      ) : showReturns ? (
        displayedReturns.length === 0 ? (
          <tr>
            <td colSpan={5} style={{ textAlign: "center", padding: 20 }}>
              لا توجد مرتجعات في الفترة المحددة.
            </td>
          </tr>
        ) : (
          displayedReturns.map((ret) => {
            const origMs = toMillis(ret.originalDate);
            const origDateStr = origMs
              ? new Date(origMs).toLocaleDateString("ar-EG")
              : ret.originalDate || "-";
            const retMs = toMillis(ret.returnDate);
            const retDateStr = retMs
              ? new Date(retMs).toLocaleDateString("ar-EG")
              : ret.returnDate || "-";

            return (
              <tr key={ret.id}>
                <td>{ret.item?.name}</td>
                <td>{ret.item?.quantity}</td>
                <td>{ret.item?.sellPrice}</td>
                <td>{origDateStr}</td>
                <td>{retDateStr}</td>
              </tr>
            );
          })
        )
      ) : displayedReports.length === 0 ? (
        <tr>
          <td colSpan={6} style={{ textAlign: "center", padding: 20 }}>
            لا توجد تقارير في الفترة المحددة.
          </td>
        </tr>
      ) : (
        displayedReports.map((report) => {
          const total = Number(report.total ?? report.subtotal ?? 0);
          return (
            <tr key={report.id}>
              <td>{report.clientName || "-"}</td>
              <td>{report.phone || "-"}</td>
              <td>{report.cart?.length || 0}</td>
              <td>{total} EGP</td>
              <td>
                {report.date
                  ? new Date(report.date.seconds * 1000).toLocaleDateString(
                      "ar-EG"
                    )
                  : "-"}
              </td>
              <td>
                <button
                  className={styles.detailsBtn}
                  onClick={() => openDrawer(report)}
                >
                  عرض التفاصيل
                </button>
              </td>
            </tr>
          );
        })
      )}
    </tbody>
  </table>
</div>

          )}

          {showReturns && (
            <div className={styles.tableContainer}>
              <table>
                <thead>
                  <tr>
                    <th>المنتج</th>
                    <th>الكمية</th>
                    <th>سعر البيع</th>
                    <th>تاريخ الفاتورة الأصلية</th>
                    <th>تاريخ المرتجع</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedReturns.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: 20 }}>
                        لا توجد مرتجعات في الفترة المحددة.
                      </td>
                    </tr>
                  ) : (
                    displayedReturns.map((ret) => {
                      // عرض التاريخ الأصلي بطريقة آمنة
                      const origMs = toMillis(ret.originalDate);
                      const origDateStr = origMs ? new Date(origMs).toLocaleDateString("ar-EG") : (ret.originalDate || "-");

                      // returnDate قد يكون مخزن كسلسلة DD/MM/YYYY أو نص آخر
                      const retMs = toMillis(ret.returnDate);
                      const retDateStr = retMs ? new Date(retMs).toLocaleDateString("ar-EG") : (ret.returnDate || "-");

                      return (
                        <tr key={ret.id}>
                          <td>{ret.item?.name}</td>
                          <td>{ret.item?.quantity}</td>
                          <td>{ret.item?.sellPrice}</td>
                          <td>{origDateStr}</td>
                          <td>{retDateStr}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {isDrawerOpen && selectedReport && (
          <div className={styles.invoiceSidebar}>
            <div className={styles.sidebarHeader}>
              <h33>تفاصيل التقرير</h33>
              <button onClick={closeDrawer}>إغلاق</button>
            </div>

            <div className={styles.sidebarInfo}>
              <p><strong>اسم العميل:</strong> {selectedReport.clientName}</p>
              <p><strong>رقم الهاتف:</strong> {selectedReport.phone}</p>
              <p><strong>الموظف:</strong> {selectedReport.employee || "-"}</p>
              <p><strong>التاريخ:</strong> {selectedReport.date ? new Date(selectedReport.date.seconds * 1000).toLocaleString("ar-EG") : "-"}</p>
              <p><strong>الخصم :</strong> {selectedReport.discount ?? 0}</p>
              <p><strong>ملاحظات :</strong> {selectedReport.discountNotes ?? "-"}</p>
              <p><strong>الربح (حسب التقرير):</strong> {selectedReport.profit ?? "-"}</p>
            </div>

            <div className={styles.sidebarProducts}>
              <h5>المنتجات</h5>
              <table>
                <thead>
                  <tr>
                    <th>المنتج</th>
                    <th>السعر</th>
                    <th>الكمية</th>
                    <th>الحالة</th>
                    <th>السريال</th>
                    <th>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReport.cart?.map((item, index) => (
                    <tr key={index}>
                      <td>{item.name} {item.color ? ` - ${item.color}` : ""} {item.size ? ` - ${item.size}` : ""}</td>
                      <td>{item.sellPrice}</td>
                      <td>{item.quantity}</td>
                      <td>{item.condition || "-"}</td>
                      <td>{item.serial || "-"}</td>
                      <td>
                        <button className={styles.returnBtn} onClick={() => handleReturnProduct(item, selectedReport.id)}>
                          مرتجع
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}
      </div>
    );
  }

  export default Reports;
