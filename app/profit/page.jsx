'use client';
import SideBar from "@/components/SideBar/page";
import styles from "./styles.module.css";
import { db } from "../firebase";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where, addDoc, Timestamp, deleteDoc, doc, updateDoc } from "firebase/firestore";

export default function Profit() {
  const [shop, setShop] = useState('');
  const [reports, setReports] = useState([]);
  const [withdraws, setWithdraws] = useState([]);
  const [dailyProfitData, setDailyProfitData] = useState([]);
  const [cashTotal, setCashTotal] = useState(0);
  const [profit, setProfit] = useState(0);
  const [mostafaBalance, setMostafaBalance] = useState(0);
  const [midoBalance, setMidoBalance] = useState(0);
  const [doubleMBalance, setDoubleMBalance] = useState(0);
  const [deletedProducts, setDeletedProducts] = useState([]);
  const [deletedTotal, setDeletedTotal] = useState(0);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [withdrawPerson, setWithdrawPerson] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [showPayPopup, setShowPayPopup] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payPerson, setPayPerson] = useState("");
  const [payWithdrawId, setPayWithdrawId] = useState(null);
  const [isHidden, setIsHidden] = useState(true);
  const [showAddCashPopup, setShowAddCashPopup] = useState(false);
  const [addCashAmount, setAddCashAmount] = useState("");
  const [showNotes, setShowNotes] = useState(""); // ملاحظات عملية السحب أو إضافة الخزنة
  const [lastResetTimestamp, setLastResetTimestamp] = useState(null); // لتصفير الأرباح والسحوبات

  // تحويل الأرقام العربية إلى إنجليزية
  const arabicToEnglishNumbers = (str) => {
    if (!str) return str;
    const map = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
    return str.replace(/[٠-٩]/g, d => map[d]);
  };

  // دالة موحدة لتحويل أي نوع تاريخ إلى Date
  const parseDate = (val) => {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (val?.toDate) return val.toDate();
    if (val?.seconds) return new Date(val.seconds * 1000);

    if (typeof val === "string") {
      val = arabicToEnglishNumbers(val.trim());
      const dmyMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (dmyMatch) {
        const [, d, m, y] = dmyMatch;
        return new Date(Number(y), Number(m) - 1, Number(d));
      }
      const isoMatch = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (isoMatch) {
        const [, y, m, d] = isoMatch;
        return new Date(Number(y), Number(m) - 1, Number(d));
      }
      const tryDate = new Date(val);
      if (!isNaN(tryDate)) return tryDate;
    }
    return null;
  };

  // تحويل التاريخ لعرض DD/MM/YYYY
  const formatDate = (date) => {
    if (!date) return "—";
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShop(localStorage.getItem('shop'));
      const savedHiddenState = localStorage.getItem('hideFinance');
      if (savedHiddenState !== null) setIsHidden(savedHiddenState === 'true');
      const savedReset = localStorage.getItem('lastResetTimestamp');
      if (savedReset) setLastResetTimestamp(new Date(savedReset));
    }
  }, []);

  const toggleHidden = () => {
    setIsHidden(prev => {
      const newState = !prev;
      localStorage.setItem('hideFinance', newState);
      return newState;
    });
  };

  const fetchData = async () => {
    if (!shop) return;

    const reportsSnap = await getDocs(query(collection(db, "reports"), where("shop", "==", shop)));
    setReports(reportsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    const withdrawsSnap = await getDocs(query(collection(db, "withdraws"), where("shop", "==", shop)));
    setWithdraws(withdrawsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    const dailyProfitSnap = await getDocs(query(collection(db, "dailyProfit"), where("shop", "==", shop)));
    setDailyProfitData(dailyProfitSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    const deletedSnap = await getDocs(query(collection(db, "deletedProducts"), where("shop", "==", shop)));
    const deletedArr = deletedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setDeletedProducts(deletedArr);
    const totalDeleted = deletedArr.reduce((sum, p) => sum + ((p.sellPrice || 0) * (p.quantity || 0)), 0);
    setDeletedTotal(totalDeleted);
  };

  useEffect(() => { fetchData(); }, [shop]);

  // تصفير الأرباح والسحوبات (ماعدا الخزنة)
  const handleReset = () => {
    const now = new Date();
    setLastResetTimestamp(now);
    localStorage.setItem('lastResetTimestamp', now.toISOString());
    setProfit(0);
    setMostafaBalance(0);
    setMidoBalance(0);
    setDoubleMBalance(0);
  };

  useEffect(() => {
    if (!shop) return;

    const from = dateFrom ? new Date(dateFrom + "T00:00:00") : new Date("1970-01-01");
    const to = dateTo ? new Date(dateTo + "T23:59:59") : new Date();

    const filteredDaily = dailyProfitData.filter(d => {
      const dDate = parseDate(d.date) || parseDate(d.createdAt);
      if (!dDate) return false;
      if (lastResetTimestamp && dDate >= lastResetTimestamp) return false; // العمليات بعد التصفير تظهر صفر
      return dDate >= from && dDate <= to;
    });

    const filteredReports = reports.filter(r => {
      const rDate = parseDate(r.date) || parseDate(r.createdAt);
      if (!rDate) return false;
      if (lastResetTimestamp && rDate >= lastResetTimestamp) return false;
      return rDate >= from && rDate <= to;
    });

    const filteredWithdraws = withdraws.filter(w => {
      const wDate = parseDate(w.date) || parseDate(w.createdAt);
      if (!wDate) return true;
      if (lastResetTimestamp && wDate >= lastResetTimestamp) return false;
      return wDate >= from && wDate <= to;
    });

    const totalMasrofat = filteredDaily.reduce((sum, d) => sum + (d.totalMasrofat || 0), 0);
    const totalCash = filteredDaily.reduce((sum, d) => sum + (d.totalSales || 0), 0);
    let remainingCash = totalCash - totalMasrofat;

    filteredWithdraws.forEach(w => {
      const remaining = (w.amount || 0) - (w.paid || 0);
      remainingCash -= remaining;
    });
    setCashTotal(remainingCash);

    let remainingProfit = filteredReports.reduce((sum, r) => {
      if (!r.cart || !Array.isArray(r.cart)) return sum;
      return sum + r.cart.reduce((s, item) => s + ((item.sellPrice || 0) - (item.buyPrice || 0)) * (item.quantity || 0), 0);
    }, 0);

    let mostafaSum = 0, midoSum = 0, doubleMSum = 0;
    filteredWithdraws.forEach(w => {
      const remaining = (w.amount || 0) - (w.paid || 0);
      remainingProfit -= remaining;
      if (w.person === "مصطفى") mostafaSum += remaining;
      if (w.person === "ميدو") midoSum += remaining;
      if (w.person === "دبل M") doubleMSum += remaining;
    });

    const returnedProfit = filteredDaily.reduce((sum, d) => sum + (d.returnedProfit || 0), 0);
    remainingProfit -= returnedProfit;

    setProfit(remainingProfit);
    setMostafaBalance(mostafaSum);
    setMidoBalance(midoSum);
    setDoubleMBalance(doubleMSum);

  }, [dateFrom, dateTo, dailyProfitData, reports, withdraws, shop, lastResetTimestamp]);

  const handleWithdraw = async () => {
    if (!withdrawPerson || !withdrawAmount) return alert("اختر الشخص واكتب المبلغ");
    const amount = Number(withdrawAmount);
    if (amount <= 0) return alert("المبلغ غير صالح");
    if (amount > cashTotal) return alert("رصيد الخزنة غير كافي");

    const newDate = formatDate(new Date());
    const docRef = await addDoc(collection(db, "withdraws"), {
      shop,
      person: withdrawPerson,
      amount,
      date: newDate,
      createdAt: Timestamp.now(),
      paid: 0,
      notes: showNotes
    });

    setWithdraws(prev => [
      ...prev,
      { id: docRef.id, person: withdrawPerson, amount, date: newDate, createdAt: Timestamp.now(), paid: 0, notes: showNotes },
    ]);

    setWithdrawPerson("");
    setWithdrawAmount("");
    setShowNotes("");
    setShowPopup(false);
  };

  const handleAddCash = async () => {
    const amount = Number(addCashAmount);
    if (!amount || amount <= 0) return alert("ادخل مبلغ صالح");

    const newDate = formatDate(new Date());
    await addDoc(collection(db, "dailyProfit"), {
      shop,
      totalSales: amount,
      totalMasrofat: 0,
      returnedProfit: 0,
      date: newDate,
      createdAt: Timestamp.now(),
      notes: showNotes
    });

    setAddCashAmount("");
    setShowNotes("");
    setShowAddCashPopup(false);
    fetchData();
  };

  const handleDeleteWithdraw = async (id) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, "withdraws", id));
      setWithdraws(prev => prev.filter(w => w.id !== id));
    } catch (error) {
      console.error("خطأ أثناء الحذف:", error);
    }
  };

  const handleOpenPay = (withdraw) => {
    setPayWithdrawId(withdraw.id);
    setPayPerson(withdraw.person);
    setPayAmount("");
    setShowPayPopup(true);
  };

  const handlePay = async () => {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return alert("ادخل مبلغ صالح");

    const withdraw = withdraws.find(w => w.id === payWithdrawId);
    if (!withdraw) return alert("حدث خطأ");

    const remainingDebt = withdraw.amount - (withdraw.paid || 0);
    if (amount > remainingDebt) return alert(`المبلغ أكبر من المبلغ المستحق: ${remainingDebt}`);

    const withdrawRef = doc(db, "withdraws", payWithdrawId);
    await updateDoc(withdrawRef, { paid: (withdraw.paid || 0) + amount });

    setWithdraws(prev => prev.map(w => w.id === payWithdrawId ? { ...w, paid: (w.paid || 0) + amount } : w));
    setShowPayPopup(false);
  };

  return (
    <div className={styles.profit}>
      <SideBar />
      <div className={styles.content}>
        <div className={styles.title}><h2>الارباح</h2></div>

        <div className={styles.inputDate}>
          <div className="inputContainer">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="inputContainer">
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>

        <button onClick={toggleHidden} className={styles.withdrawBtn} style={{ marginTop: '15px' }}>
          {isHidden ? "👁️ إظهار الأرقام" : "🙈 إخفاء الأرقام"}
        </button>

        <button onClick={handleReset} className={styles.withdrawBtn} style={{ marginTop: '15px', marginLeft: '10px' }}>
          تصفير الأرباح والسحوبات
        </button>

        <div className={styles.cardContent}>
          <div className={styles.cardsContainer}>
            <div className={styles.card}><h4>الخزنة</h4><p>{isHidden ? "*****" : cashTotal}</p></div>
            <div className={styles.card}><h4>مرتجع المنتجات</h4><p>{isHidden ? "*****" : deletedTotal}</p></div>
          </div>
          <div className={styles.cardsContainer}>
            <div className={styles.card}><h4>الربح</h4><p>{isHidden ? "*****" : profit}</p></div>
            <div className={styles.card}><h4>مصطفى</h4><p>{isHidden ? "*****" : mostafaBalance}</p></div>
            <div className={styles.card}><h4>ميدو</h4><p>{isHidden ? "*****" : midoBalance}</p></div>
            <div className={styles.card}><h4>دبل M</h4><p>{isHidden ? "*****" : doubleMBalance}</p></div>
          </div>
        </div>

        <button onClick={() => setShowPopup(true)} className={styles.withdrawBtn}>سحب</button>
        <button onClick={() => setShowAddCashPopup(true)} className={styles.withdrawBtn} style={{ marginLeft: '10px' }}>إضافة للخزنة</button>

        <div className={styles.tableContainer}>
          <table>
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
              {withdraws.map(w => {
                const wDate = parseDate(w.date) || parseDate(w.createdAt);
                if (lastResetTimestamp && wDate >= lastResetTimestamp) return null;
                return (
                  <tr key={w.id}>
                    <td>{w.person}</td>
                    <td>{isHidden ? "*****" : w.amount}</td>
                    <td>{isHidden ? "*****" : (w.paid || 0)}</td>
                    <td>{isHidden ? "*****" : (w.amount - (w.paid || 0))}</td>
                    <td>{formatDate(wDate)}</td>
                    <td>{w.notes || "—"}</td>
                    <td>{(w.amount - (w.paid || 0)) > 0 && <button className={styles.delBtn} onClick={() => handleDeleteWithdraw(w.id)}>حذف</button>}</td>
                    <td>{(w.amount - (w.paid || 0)) > 0 && <button className={styles.payBtn} onClick={() => handleOpenPay(w)}>سداد</button>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {showPopup && (
          <div className={styles.popup}>
            <div className={styles.popupContent}>
              <h3>عملية سحب</h3>
              <select value={withdrawPerson} onChange={e => setWithdrawPerson(e.target.value)}>
                <option value="">اختر الشخص</option>
                <option value="مصطفى">مصطفى</option>
                <option value="ميدو">ميدو</option>
                <option value="دبل M">دبل M</option>
              </select>
              <input type="number" placeholder="المبلغ" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} />
              <input type="text" placeholder="ملاحظات" value={showNotes} onChange={e => setShowNotes(e.target.value)} />
              <div className={styles.popupActions}>
                <button onClick={handleWithdraw}>تأكيد</button>
                <button onClick={() => setShowPopup(false)}>إلغاء</button>
              </div>
            </div>
          </div>
        )}

        {showPayPopup && (
          <div className={styles.popup}>
            <div className={styles.popupContent}>
              <h3>سداد مبلغ</h3>
              <p>الشخص: {payPerson}</p>
              <input type="number" placeholder="المبلغ" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
              <div className={styles.popupActions}>
                <button onClick={handlePay}>تأكيد</button>
                <button onClick={() => setShowPayPopup(false)}>إلغاء</button>
              </div>
            </div>
          </div>
        )}

        {showAddCashPopup && (
          <div className={styles.popup}>
            <div className={styles.popupContent}>
              <h3>إضافة مبلغ للخزنة</h3>
              <input type="number" placeholder="المبلغ" value={addCashAmount} onChange={e => setAddCashAmount(e.target.value)} />
              <input type="text" placeholder="ملاحظات" value={showNotes} onChange={e => setShowNotes(e.target.value)} />
              <div className={styles.popupActions}>
                <button onClick={handleAddCash}>تأكيد</button>
                <button onClick={() => setShowAddCashPopup(false)}>إلغاء</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
