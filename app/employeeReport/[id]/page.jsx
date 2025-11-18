'use client';
import styles from "./styles.module.css";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  doc,
  deleteDoc,
  Timestamp
} from "firebase/firestore";
import SideBar from "@/components/SideBar/page";
import { db } from "@/app/firebase";

function EmployeeReports() {
  const { id } = useParams();
  const [employee, setEmployee] = useState(null);
  const [salary, setSalary] = useState(0);
  const [percentage, setPercentage] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [commission, setCommission] = useState(0);
  const [adjustments, setAdjustments] = useState([]);
  const [hoursRecords, setHoursRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  // state صافي الراتب
  const [netSalary, setNetSalary] = useState(0);

  // form states
  const [hourDate, setHourDate] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [adjustType, setAdjustType] = useState("bonus");
  const [adjustValue, setAdjustValue] = useState("");
  const [adjustNote, setAdjustNote] = useState("");

  // ===== جلب بيانات الموظف =====
  useEffect(() => {
    if (!id) return;
    const empQuery = query(collection(db, "employees"), where("__name__", "==", id));
    const unsubscribe = onSnapshot(empQuery, (snapshot) => {
      if (!snapshot.empty) {
        const empData = snapshot.docs[0].data();
        setEmployee(empData);
        setSalary(parseFloat(empData.salary) || 0);
        setPercentage(parseFloat(empData.percentage) || 0);
      }
    });
    return () => unsubscribe();
  }, [id]);

  // ===== جلب المبيعات للعمولة =====
  useEffect(() => {
    if (!employee?.name) return;
    const q = query(collection(db, "employeesReports"), where("employee", "==", employee.name));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data());
      const total = data.reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
      setTotalSales(total);
      setCommission(total * (percentage / 100));
    });
    return () => unsubscribe();
  }, [employee, percentage]);

  // ===== جلب سجلات الساعات =====
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const q = query(collection(db, "employeeHours"), where("employeeId", "==", id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.dateISO || "").localeCompare(a.dateISO || ""));
      setHoursRecords(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [id]);

  // ===== جلب العلاوات/الخصومات =====
  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, "employeeAdjustments"), where("employeeId", "==", id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAdjustments(data);
    });
    return () => unsubscribe();
  }, [id]);

  // ===== حساب قيمة الساعة =====
  const today = new Date();
  const daysInMonth = (year, month) => new Date(year, month, 0).getDate();
  const daysThisMonth = daysInMonth(today.getFullYear(), today.getMonth() + 1);
  const hourlyRate = salary / (daysThisMonth * 12);

  const computeHoursBetween = (inTime, outTime) => {
    if (!inTime || !outTime) return 0;
    const [ih, im] = inTime.split(":").map(Number);
    const [oh, om] = outTime.split(":").map(Number);
    let start = ih * 60 + im;
    let end = oh * 60 + om;
    if (end < start) end += 24 * 60;
    return parseFloat(((end - start) / 60).toFixed(2));
  };

  // ===== حفظ سجل ساعات =====
  const handleSaveHourRecord = async () => {
    if (!hourDate || !checkIn || !checkOut) return alert("من فضلك أكمل جميع الحقول");
    const hours = computeHoursBetween(checkIn, checkOut);
    try {
      await addDoc(collection(db, "employeeHours"), {
        employeeId: id,
        dateISO: hourDate,
        date: `${hourDate.split("-")[2]}/${hourDate.split("-")[1]}/${hourDate.split("-")[0]}`,
        checkIn,
        checkOut,
        hours,
        createdAt: Timestamp.now()
      });
      // تحديث صافي الراتب مباشرة
      setNetSalary(prev => prev + hours * hourlyRate);
      setHourDate(""); setCheckIn(""); setCheckOut("");
      alert("تم حفظ سجل الساعات ✅");
    } catch (err) {
      console.error(err); alert("حدث خطأ أثناء الحفظ");
    }
  };

  // ===== حفظ خصم/علاوة =====
  const handleSaveAdjustment = async () => {
    if (!adjustValue || isNaN(adjustValue)) return alert("من فضلك أدخل قيمة صحيحة");
    try {
      await addDoc(collection(db, "employeeAdjustments"), {
        employeeId: id,
        type: adjustType,
        value: parseFloat(adjustValue),
        note: adjustNote,
        date: Timestamp.now()
      });
      if (adjustType === "bonus") setNetSalary(prev => prev + parseFloat(adjustValue));
      else setNetSalary(prev => prev - parseFloat(adjustValue));

      setAdjustValue(""); setAdjustNote(""); setShowPopup(false);
      alert("تمت العملية ✅");
    } catch (err) {
      console.error(err); alert("حدث خطأ أثناء الحفظ");
    }
  };

  // ===== حذف سجل =====
  const handleDeleteHourRecord = async (record) => {
    if (!window.confirm("هل تريد حذف هذا السجل؟")) return;
    try {
      await deleteDoc(doc(db, "employeeHours", record.id));
      setNetSalary(prev => prev - (record.hours * hourlyRate));
    } catch (err) { console.error(err); alert("حدث خطأ أثناء الحذف"); }
  };

  const handleDeleteAdjustment = async (record) => {
    if (!window.confirm("هل تريد حذف هذه العملية؟")) return;
    try {
      await deleteDoc(doc(db, "employeeAdjustments", record.id));
      if (record.type === "bonus") setNetSalary(prev => prev - record.value);
      else setNetSalary(prev => prev + record.value);
    } catch (err) { console.error(err); alert("حدث خطأ أثناء الحذف"); }
  };

  // ===== دمج البيانات للعرض =====
  const combinedRecords = [
    ...hoursRecords.map(r => ({
      id: r.id,
      date: r.date,
      type: "hours",
      hours: r.hours,
      value: (r.hours * hourlyRate).toFixed(2),
      note: `حضور ${r.checkIn} - انصراف ${r.checkOut}`
    })),
    ...adjustments.map(a => ({
      id: a.id,
      date: a.date?.toDate ? a.date.toDate().toLocaleDateString() : a.date ? new Date(a.date).toLocaleDateString() : "-",
      type: a.type,
      hours: "-",
      value: a.value,
      note: a.note || "-"
    }))
  ].sort((a,b) => b.date.localeCompare(a.date));

  return (
    <div className={styles.employeeReport}>
      <SideBar />
      <div className={styles.content}>
        <h2>بيانات الموظف: {employee?.name}</h2>

        <div className={styles.cardContainer}>
          <div className={styles.card}><h3>صافي الراتب</h3><p>{netSalary.toFixed(2)} جنيه</p></div>
          <div className={styles.card}><h3>مجموع الساعات</h3><p>{hoursRecords.reduce((sum,r)=>sum+(r.hours||0),0)}</p></div>
          <div className={styles.card}><h3>قيمة الساعة</h3><p>{hourlyRate.toFixed(2)}</p></div>
        </div>

        {/* form إضافة ساعة/خصم/علاوة */}
        <div className={styles.hourForm}>
          <h3>إضافة سجل ساعة</h3>
          <label>التاريخ:</label><input type="date" value={hourDate} onChange={e=>setHourDate(e.target.value)} />
          <label>حضور:</label><input type="time" value={checkIn} onChange={e=>setCheckIn(e.target.value)} />
          <label>انصراف:</label><input type="time" value={checkOut} onChange={e=>setCheckOut(e.target.value)} />
          <button onClick={handleSaveHourRecord}>حفظ سجل</button>
          <button style={{marginLeft:10}} onClick={()=>{setAdjustType("deduction"); setShowPopup(true)}}>خصم على الموظف</button>
          <button style={{marginLeft:10}} onClick={()=>{setAdjustType("bonus"); setShowPopup(true)}}>علاوة</button>
        </div>

        {/* جدول */}
        <div className={styles.tableContainer} style={{marginTop:20}}>
          <table>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>النوع</th>
                <th>الساعات</th>
                <th>القيمة</th>
                <th>ملاحظة</th>
                <th>التحكم</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan="6">جارٍ التحميل...</td></tr>
              : combinedRecords.length>0 ? combinedRecords.map(r=>(
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{r.type==="hours"?"ساعات":r.type==="bonus"?"علاوة":"خصم"}</td>
                  <td>{r.hours}</td>
                  <td>{r.value}</td>
                  <td>{r.note}</td>
                  <td>
                    {r.type==="hours" ? <button onClick={()=>handleDeleteHourRecord(r)}>🗑️ حذف</button>
                    : <button onClick={()=>handleDeleteAdjustment(r)}>🗑️ حذف</button>}
                  </td>
                </tr>
              )) : <tr><td colSpan="6">لا توجد بيانات بعد</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Popup خصم/علاوة */}
        {showPopup && (
          <div className={styles.popupOverlay}>
            <div className={styles.popup}>
              <h3>{adjustType==="bonus"?"إضافة علاوة":"إضافة خصم"}</h3>
              <label>القيمة:</label>
              <input type="number" value={adjustValue} onChange={e=>setAdjustValue(e.target.value)} />
              <label>ملاحظة:</label>
              <textarea value={adjustNote} onChange={e=>setAdjustNote(e.target.value)} />
              <div style={{marginTop:10}}>
                <button onClick={handleSaveAdjustment}>حفظ</button>
                <button onClick={()=>{setShowPopup(false); setAdjustValue(""); setAdjustNote("");}}>إلغاء</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default EmployeeReports;
