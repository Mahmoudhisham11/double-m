'use client';
import SideBar from "@/components/SideBar/page";
import styles from "./styles.module.css";
import { db } from "../firebase";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where, addDoc, Timestamp, deleteDoc, doc, updateDoc } from "firebase/firestore";

export default function Profit() {
  const [shop, setShop] = useState('');
  const [isResetActive, setIsResetActive] = useState(false);
  const [resetAt, setResetAt] = useState(null);
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
  const [withdrawNotes, setWithdrawNotes] = useState("");
  const [showPayPopup, setShowPayPopup] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payPerson, setPayPerson] = useState("");
  const [payWithdrawId, setPayWithdrawId] = useState(null);
  const [isHidden, setIsHidden] = useState(true);
  const [showAddCashPopup, setShowAddCashPopup] = useState(false);
  const [addCashAmount, setAddCashAmount] = useState("");
  const [addCashNotes, setAddCashNotes] = useState("");

  // حالات الأرباح بعد التصفير (محفوظة إن احتجت لاحقًا)
  const [profitAfterReset, setProfitAfterReset] = useState(null);
  const [mostafaAfterReset, setMostafaAfterReset] = useState(null);
  const [midoAfterReset, setMidoAfterReset] = useState(null);
  const [doubleMAfterReset, setDoubleMAfterReset] = useState(null);

  const arabicToEnglishNumbers = (str) => {
    if (!str) return str;
    const map = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
    return str.replace(/[٠-٩]/g, d => map[d]);
  };

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

      const savedReset = localStorage.getItem("resetAt");
      if (savedReset) setResetAt(new Date(savedReset));
    }
  }, []);

  const toggleHidden = () => {
    setIsHidden(prev => {
      const newState = !prev;
      localStorage.setItem('hideFinance', newState);
      return newState;
    });
  };

  const fetchReset = async () => {
    if (!shop) return;

    const resetSnap = await getDocs(query(collection(db, "reset"), where("shop", "==", shop)));
    const resets = resetSnap.docs.map(doc => doc.data());

    if (resets.length > 0) {
      const latestReset = resets.reduce((prev, curr) => {
        const prevTs = prev.resetAt?.seconds ? prev.resetAt.seconds : (new Date(prev.resetAt)).getTime() / 1000;
        const currTs = curr.resetAt?.seconds ? curr.resetAt.seconds : (new Date(curr.resetAt)).getTime() / 1000;
        return prevTs > currTs ? prev : curr;
      });
      const val = latestReset.resetAt;
      setResetAt(val?.toDate ? val.toDate() : new Date(val));
    }
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
    const totalDeleted = deletedArr.reduce((sum, p) => sum + ((Number(p.buyPrice) || 0) * (Number(p.deletedTotalQty) || 0)), 0);
    setDeletedTotal(totalDeleted);
  };

  useEffect(() => {
    if (!shop) return;

    fetchData();
    fetchReset();
  }, [shop]);

  useEffect(() => {
    if (!shop) return;

    const from = dateFrom ? new Date(dateFrom + "T00:00:00") : new Date("1970-01-01");
    const to = dateTo ? new Date(dateTo + "T23:59:59") : new Date();

    const isUsingDateFilter = Boolean(dateFrom || dateTo);
    const effectiveFrom = isUsingDateFilter ? from : (resetAt ? resetAt : from);

    const dailyForCash = dailyProfitData.filter(d => {
      const dDate = parseDate(d.date) || parseDate(d.createdAt);
      return dDate && dDate >= from && dDate <= to;
    });

    const filteredDaily = dailyProfitData.filter(d => {
      const dDate = parseDate(d.date) || parseDate(d.createdAt);
      return dDate && dDate >= effectiveFrom && dDate <= to;
    });

    const filteredReports = reports.filter(r => {
      const rDate = parseDate(r.date) || parseDate(r.createdAt);
      return rDate && rDate >= effectiveFrom && rDate <= to;
    });

    const withdrawsForCash = withdraws.filter(w => {
      const wDate = parseDate(w.date) || parseDate(w.createdAt);
      return wDate >= from && wDate <= to;
    });

    const filteredWithdraws = withdraws.filter(w => {
      const wDate = parseDate(w.date) || parseDate(w.createdAt);
      return wDate >= effectiveFrom && wDate <= to;
    });

    const totalMasrofat = dailyForCash.reduce((sum, d) => sum + (d.totalMasrofat || 0), 0);
    const totalCash = dailyForCash.reduce((sum, d) => sum + (d.totalSales || 0), 0);

    let remainingCash = totalCash - totalMasrofat;

    withdrawsForCash.forEach(w => {
      const remaining = (w.amount || 0) - (w.paid || 0);
      remainingCash -= remaining;
    });

    setCashTotal(remainingCash < 0 ? 0 : remainingCash);

    let remainingProfit = 0;
    filteredReports.forEach(r => {
      if (!r.cart || !Array.isArray(r.cart)) return;
      const reportProfit = r.cart.reduce((s, item) => {
        const sell = Number(item.sellPrice) || 0;
        const buy = Number(item.buyPrice) || 0;
        const qty = Number(item.quantity) || 0;
        return s + (sell - buy) * qty;
      }, 0);
      remainingProfit += reportProfit;
    });

    let mostafaSum = 0, midoSum = 0, doubleMSum = 0;
    filteredWithdraws.forEach(w => {
      const remaining = (Number(w.amount) || 0) - (Number(w.paid) || 0);
      remainingProfit -= remaining;
      if (w.person === "مصطفى") mostafaSum += remaining;
      if (w.person === "ميدو") midoSum += remaining;
      if (w.person === "دبل M") doubleMSum += remaining;
    });

    const returnedProfit = filteredDaily.reduce((sum, d) => sum + (Number(d.returnedProfit) || 0), 0);
    remainingProfit -= returnedProfit;

    setProfit(remainingProfit < 0 ? 0 : remainingProfit);
    setMostafaBalance(mostafaSum < 0 ? 0 : mostafaSum);
    setMidoBalance(midoSum < 0 ? 0 : midoSum);
    setDoubleMBalance(doubleMSum < 0 ? 0 : doubleMSum);

  }, [dateFrom, dateTo, dailyProfitData, reports, withdraws, shop, resetAt]);

  const handleWithdraw = async () => {
    if (!withdrawPerson || !withdrawAmount) return alert("اختر الشخص واكتب المبلغ");
    const amount = Number(withdrawAmount);
    if (amount <= 0) return alert("المبلغ غير صالح");
    if (amount > cashTotal) return alert("رصيد الخزنة غير كافي");

    const newDate = new Date(); // وقت فعلي
    await addDoc(collection(db, "withdraws"), {
      shop,
      person: withdrawPerson,
      amount,
      notes: withdrawNotes,
      date: formatDate(newDate),
      createdAt: Timestamp.fromDate(newDate),
      paid: 0
    });

    await fetchData();

    // تحديث الربح ورصيد الشخص مباشرة بعد السحب
    setProfit(prev => prev - amount);
    if (withdrawPerson === "مصطفى") setMostafaBalance(prev => prev + amount);
    if (withdrawPerson === "ميدو") setMidoBalance(prev => prev + amount);
    if (withdrawPerson === "دبل M") setDoubleMBalance(prev => prev + amount);

    setWithdrawPerson("");
    setWithdrawAmount("");
    setWithdrawNotes("");
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
      notes: addCashNotes,
      date: newDate,
      createdAt: Timestamp.now(),
    });

    await fetchData();

    setAddCashAmount("");
    setAddCashNotes("");
    setShowAddCashPopup(false);
  };

  const handleResetProfit = async () => {
    const confirmReset = confirm("هل أنت متأكد من تصفير الأرباح والأرصدة؟");
    if (!confirmReset) return;

    const now = Timestamp.now();

    await addDoc(collection(db, "reset"), {
      shop,
      resetAt: now,
    });

    const nowDate = new Date();
    localStorage.setItem("resetAt", nowDate.toISOString());
    setResetAt(nowDate);
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

    await fetchData();

    // تحديث الربح فورًا بعد السداد
    setProfit(prev => prev + amount);

    setShowPayPopup(false);
  };

  const handleClearDeletedProducts = async () => {
    if (!shop) return alert("لم يتم العثور على المتجر");

    const sure = confirm("هل أنت متأكد من حذف كل المنتجات المرتجعة؟");
    if (!sure) return;

    try {
      const q = query(collection(db, "deletedProducts"), where("shop", "==", shop));
      const snap = await getDocs(q);

      const deletePromises = snap.docs.map(d => deleteDoc(doc(db, "deletedProducts", d.id)));

      await Promise.all(deletePromises);

      setDeletedProducts([]);
      setDeletedTotal(0);

      alert("تم حذف جميع المنتجات المرتجعة بنجاح ✔");
    } catch (err) {
      console.error("خطأ أثناء حذف المرتجعات:", err);
      alert("حدث خطأ أثناء الحذف");
    }
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

        <button onClick={handleResetProfit} className={styles.withdrawBtn} style={{ marginLeft: '10px' }}>
          تصفير الأرباح
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
        <button 
          onClick={handleClearDeletedProducts} 
          className={styles.withdrawBtn} 
          style={{ marginLeft: '10px', backgroundColor: 'red', color: '#fff' }}
        >
          مسح كل المرتجعات
        </button>
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
                  {withdraws.map(w => (
                    <tr key={w.id}>
                      <td>{w.person}</td>
                      <td>{isHidden ? "*****" : w.amount}</td>
                      <td>{isHidden ? "*****" : (w.paid || 0)}</td>
                      <td>{isHidden ? "*****" : (w.amount - (w.paid || 0))}</td>
                      <td>{formatDate(parseDate(w.date) || parseDate(w.createdAt))}</td>
                      <td>{w.notes || ""}</td>
                      <td>{(w.amount - (w.paid || 0)) > 0 && <button className={styles.delBtn} onClick={() => handleDeleteWithdraw(w.id)}>حذف</button>}</td>
                        <td>{(w.amount - (w.paid || 0)) > 0 && <button className={styles.payBtn} onClick={() => handleOpenPay(w)}>سداد</button>}</td> </tr> ))}
                        </tbody>
                        </table> 
                          </div>
      </div>


      {showPopup && ( 
        <div className={styles.popup}>
           <div className={styles.popupContent}>
             <h3>عملية سحب</h3>
              <select value={withdrawPerson} 
              onChange={e => setWithdrawPerson(e.target.value)}>
                 <option value="">اختر الشخص</option> 
                 <option value="مصطفى">مصطفى</option>
                  <option value="ميدو">ميدو</option>
                   <option value="دبل M">دبل M</option>
                    </select> 
                    <input type="number" placeholder="المبلغ" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} /> 
                    <input type="text" placeholder="ملاحظات" value={withdrawNotes} onChange={e => setWithdrawNotes(e.target.value)} /> 
                    <div className={styles.popupActions}> 
                      <button onClick={handleWithdraw}>تأكيد</button>
                       <button onClick={() => setShowPopup(false)}>إلغاء</button> 
                       </div>
                        </div>
                         </div> 
                        )}

      {showAddCashPopup && ( 
        <div className={styles.popup}> 
        <div className={styles.popupContent}> 
          <h3>إضافة مبلغ للخزنة</h3>
           <input type="number" placeholder="المبلغ" value={addCashAmount} onChange={e => setAddCashAmount(e.target.value)} /> 
           <input type="text" placeholder="ملاحظات" value={addCashNotes} onChange={e => setAddCashNotes(e.target.value)} /> 
           <div className={styles.popupActions}> <button onClick={handleAddCash}>تأكيد</button> 
           <button onClick={() => setShowAddCashPopup(false)}>إلغاء</button>
            </div> 
            </div> 
            </div> 
          )}

      {showPayPopup && ( 
        <div className={styles.popup}> 
        <div className={styles.popupContent}>
           <h3>سداد مبلغ</h3> <p>الشخص: {payPerson}</p>
            <input type="number" placeholder="المبلغ" value={payAmount}
             onChange={e => setPayAmount(e.target.value)} /> 
             <div className={styles.popupActions}> 
        <button onClick={handlePay}>تأكيد</button>
         <button onClick={() => setShowPayPopup(false)}>إلغاء</button> 
         </div> 
         </div>
          </div> 
        )}
    </div>
  );
}
