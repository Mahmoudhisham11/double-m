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

  // تحويل الأرقام العربية إلى إنجليزية
  const arabicToEnglishNumbers = (str) => {
    if (!str) return str;
    const map = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
    return str.replace(/[٠-٩]/g, d => map[d]);
  };

  // تعديل parseDate لدعم التواريخ العربية و Timestamp
  const parseDate = (val) => {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (val?.toDate) return val.toDate();
    if (val?.seconds) return new Date(val.seconds * 1000);

    if (typeof val === "string") {
      val = arabicToEnglishNumbers(val);
      const isoMatch = val.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
      if (isoMatch) {
        const [, y, m, d] = isoMatch;
        return new Date(Number(y), Number(m) - 1, Number(d));
      }
      const dmyMatch = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmyMatch) {
        const [, d, m, y] = dmyMatch;
        return new Date(Number(y), Number(m) - 1, Number(d));
      }

      const tryDate = new Date(val);
      if (!isNaN(tryDate)) return tryDate;
    }
    return null;
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShop(localStorage.getItem('shop'));
      const savedHiddenState = localStorage.getItem('hideFinance');
      if (savedHiddenState !== null) setIsHidden(savedHiddenState === 'true');
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
  };

  useEffect(() => { fetchData(); }, [shop]);

  // حساب الارصدة والربح بشكل ديناميكي
  useEffect(() => {
    if (!shop) return;

    const from = parseDate(dateFrom) || new Date("1970-01-01");
    const to = parseDate(dateTo || dateFrom) || new Date();
    to.setHours(23, 59, 59, 999);

    const filteredDaily = dailyProfitData.filter(d => {
      const dDate = parseDate(d.date || d.createdAt);
      return dDate && dDate >= from && dDate <= to;
    });

    const filteredReports = reports.filter(r => {
      const rDate = parseDate(r.date || r.createdAt);
      return rDate && rDate >= from && rDate <= to;
    });

    const filteredWithdraws = withdraws.filter(w => {
      const wDate = parseDate(w.date || w.createdAt);
      return wDate && wDate >= from && wDate <= to;
    });

    // حساب الخزنة
    const totalMasrofat = filteredDaily.reduce((sum, d) => sum + (d.totalMasrofat || 0), 0);
    const totalCash = filteredDaily.reduce((sum, d) => sum + (d.totalSales || 0), 0);
    let remainingCash = totalCash - totalMasrofat;

    filteredWithdraws.forEach(w => {
      const remaining = (w.amount || 0) - (w.paid || 0);
      remainingCash -= remaining;
    });
    setCashTotal(remainingCash);

    // حساب الربح
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

  }, [dateFrom, dateTo, dailyProfitData, reports, withdraws, shop]);

  // عمليات السحب
  const handleWithdraw = async () => {
    if (!withdrawPerson || !withdrawAmount) return alert("اختر الشخص واكتب المبلغ");
    const amount = Number(withdrawAmount);
    if (amount <= 0) return alert("المبلغ غير صالح");
    if (amount > cashTotal) return alert("رصيد الخزنة غير كافي");

    const docRef = await addDoc(collection(db, "withdraws"), {
      shop,
      person: withdrawPerson,
      amount,
      date: new Date().toLocaleDateString("ar-EG"),
      createdAt: Timestamp.now(),
      paid: 0
    });

    setWithdraws(prev => [
      ...prev,
      { id: docRef.id, person: withdrawPerson, amount, date: new Date().toLocaleDateString("ar-EG"), createdAt: Timestamp.now(), paid: 0 },
    ]);

    setWithdrawPerson("");
    setWithdrawAmount("");
    setShowPopup(false);
  };

  const handleDeleteWithdraw = async (id) => {
    if (!id) return;
    try {
      const withdraw = withdraws.find(w => w.id === id);
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

        <div className={styles.cardContent}>
          <div className={styles.cardsContainer}>
            <div className={styles.card}><h4>الخزنة</h4><p>{isHidden ? "*****" : cashTotal}</p></div>
          </div>
          <div className={styles.cardsContainer}>
            <div className={styles.card}><h4>الربح</h4><p>{isHidden ? "*****" : profit}</p></div>
            <div className={styles.card}><h4>مصطفى</h4><p>{isHidden ? "*****" : mostafaBalance}</p></div>
            <div className={styles.card}><h4>ميدو</h4><p>{isHidden ? "*****" : midoBalance}</p></div>
            <div className={styles.card}><h4>دبل M</h4><p>{isHidden ? "*****" : doubleMBalance}</p></div>
          </div>
        </div>

        <button onClick={() => setShowPopup(true)} className={styles.withdrawBtn}>سحب</button>

        <div className={styles.tableContainer}>
          <table>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>المبلغ</th>
                <th>المدفوع</th>
                <th>المتبقي</th>
                <th>التاريخ</th>
                <th>حذف</th>
                <th>سداد</th>
              </tr>
            </thead>
            <tbody>
              {withdraws.map(w => (
                <tr key={w.id}>
                  <td>{w.person}</td>
                  <td>{isHidden ? "*****" : w.amount}</td>
                  <td>{isHidden ? "*****" : (w.paid || 0)}</td>
                  <td>{isHidden ? "*****" : (w.amount - (w.paid || 0))}</td>
                  <td>{w.createdAt?.seconds ? new Date(w.createdAt.seconds * 1000).toLocaleDateString("ar-EG") : w.date || "—"}</td>
                  <td>{(w.amount - (w.paid || 0)) > 0 && <button className={styles.delBtn} onClick={() => handleDeleteWithdraw(w.id)}>حذف</button>}</td>
                  <td>{(w.amount - (w.paid || 0)) > 0 && <button className={styles.payBtn} onClick={() => handleOpenPay(w)}>سداد</button>}</td>
                </tr>
              ))}
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
      </div>
    </div>
  );
}
