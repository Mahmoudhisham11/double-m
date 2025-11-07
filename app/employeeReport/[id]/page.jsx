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
  updateDoc,
  getDocs, // ✅ مضافة لاستخدامها في حذف جميع المبيعات
} from "firebase/firestore";
import SideBar from "@/components/SideBar/page";
import { db } from "@/app/firebase";

function EmployeeReports() {
  const { id } = useParams();
  const [employee, setEmployee] = useState(null);
  const [salary, setSalary] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [commission, setCommission] = useState(0);
  const [percentage, setPercentage] = useState(0);
  const [adjustments, setAdjustments] = useState([]); // ✅ العلاوات والخصومات
  const [showPopup, setShowPopup] = useState(false);
  const [adjustType, setAdjustType] = useState("bonus"); // bonus or deduction
  const [adjustValue, setAdjustValue] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [editId, setEditId] = useState(null); // ✅ لتحديد العنصر الجاري تعديله

  useEffect(() => {
    if (!id) return;

    // ✅ جلب بيانات الموظف
    const empQuery = query(collection(db, "employees"), where("__name__", "==", id));
    const unsubscribeEmp = onSnapshot(empQuery, (snapshot) => {
      if (!snapshot.empty) {
        const empData = snapshot.docs[0].data();
        setEmployee(empData);
        setSalary(parseFloat(empData.salary) || 0);

        // ✅ جلب النسبة الخاصة بالموظف من بياناته
        setPercentage(parseFloat(empData.percentage) || 0);
      }
    });

    // ❌ تم حذف كود النسبة العامة لأنه لم يعد مستخدمًا

    return () => {
      unsubscribeEmp();
    };
  }, [id]);

  // ✅ جلب تقارير المبيعات لهذا الموظف
  useEffect(() => {
    if (!employee?.name) return;

    const q = query(collection(db, "employeesReports"), where("employee", "==", employee.name));
    const unsubscribeReports = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // ✅ إجمالي المبيعات الشهرية
      const total = data.reduce((sum, report) => sum + (parseFloat(report.total) || 0), 0);
      setTotalSales(total);

      // ✅ العمولة
      const comm = total * (percentage / 100);
      setCommission(comm);
    });

    return () => unsubscribeReports();
  }, [employee, percentage]);

  // ✅ جلب العلاوات والخصومات الخاصة بالموظف
  useEffect(() => {
    if (!id) return;

    const q = query(collection(db, "employeeAdjustments"), where("employeeId", "==", id));
    const unsubscribeAdjustments = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setAdjustments(data);
    });

    return () => unsubscribeAdjustments();
  }, [id]);

  // ✅ حفظ خصم أو علاوة جديدة أو تعديلها
  const handleSaveAdjustment = async () => {
    if (!adjustValue || isNaN(adjustValue)) {
      alert("من فضلك أدخل قيمة صحيحة");
      return;
    }

    if (editId) {
      // ✅ تعديل عنصر موجود
      const ref = doc(db, "employeeAdjustments", editId);
      await updateDoc(ref, {
        type: adjustType,
        value: parseFloat(adjustValue),
        note: adjustNote,
      });
      alert("تم تعديل العملية بنجاح ✅");
    } else {
      // ✅ إضافة عنصر جديد
      await addDoc(collection(db, "employeeAdjustments"), {
        employeeId: id,
        type: adjustType,
        value: parseFloat(adjustValue),
        note: adjustNote,
        date: new Date(),
      });
      alert("تمت الإضافة بنجاح ✅");
    }

    // ✅ إعادة تعيين الحقول
    setAdjustType("bonus");
    setAdjustValue("");
    setAdjustNote("");
    setEditId(null);
    setShowPopup(false);
  };

  // ✅ حذف عنصر
  const handleDelete = async (adjustId) => {
    const confirmDelete = window.confirm("هل أنت متأكد من حذف هذه العملية؟");
    if (!confirmDelete) return;
    await deleteDoc(doc(db, "employeeAdjustments", adjustId));
    alert("تم الحذف بنجاح ✅");
  };

  // ✅ فتح الـ Popup لتعديل عنصر
  const handleEdit = (adj) => {
    setAdjustType(adj.type);
    setAdjustValue(adj.value);
    setAdjustNote(adj.note);
    setEditId(adj.id);
    setShowPopup(true);
  };

  // ✅ حذف كل المبيعات الخاصة بالموظف
  const handleDeleteAllReports = async () => {
    if (!employee?.name) {
      alert("حدث خطأ أثناء تحديد اسم الموظف ❌");
      return;
    }

    const confirmDelete = window.confirm(
      `هل أنت متأكد من حذف جميع المبيعات الخاصة بالموظف ${employee.name}؟`
    );
    if (!confirmDelete) return;

    const q = query(collection(db, "employeesReports"), where("employee", "==", employee.name));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      alert("لا توجد مبيعات لحذفها ✅");
      return;
    }

    for (const docSnap of snapshot.docs) {
      await deleteDoc(doc(db, "employeesReports", docSnap.id));
    }

    alert("تم حذف جميع المبيعات الخاصة بالموظف بنجاح ✅");
  };

  // ✅ حساب الإجماليات
  const totalBonuses = adjustments
    .filter((a) => a.type === "bonus")
    .reduce((sum, a) => sum + a.value, 0);

  const totalDeductions = adjustments
    .filter((a) => a.type === "deduction")
    .reduce((sum, a) => sum + a.value, 0);

  const netSalary = salary + commission + totalBonuses - totalDeductions;

  return (
    <div className={styles.employeeReport}>
      <SideBar />
      <div className={styles.content}>
        <div className={styles.title}>
          {employee && <h2>بيانات الموظف: {employee.name}</h2>}
          <div className={styles.buttonsRow}>
            <button
              onClick={() => setShowPopup(true)}
              className={styles.addButton}
            >
              إضافة خصم / علاوة
            </button>

            {/* ✅ زرار حذف كل المبيعات الخاصة بالموظف */}
            <button
              onClick={handleDeleteAllReports}
              className={styles.deleteAllButton}
            >
              🗑️ حذف كل مبيعات الموظف
            </button>
          </div>
        </div>

        {/* ✅ الكروت */}
        <div className={styles.cardContainer}>
          <div className={styles.card}>
            <h3>الراتب الشهري</h3>
            <p>{salary} جنيه</p>
          </div>

          <div className={styles.card}>
            <h3>إجمالي المبيعات</h3>
            <p>{totalSales.toFixed(2)} جنيه</p>
          </div>

          <div className={styles.card}>
            <h3>العمولة ({percentage}%)</h3>
            <p>{commission.toFixed(2)} جنيه</p>
          </div>

          <div className={styles.card}>
            <h3>صافي الراتب</h3>
            <p>{netSalary.toFixed(2)} جنيه</p>
          </div>
        </div>

        {/* ✅ جدول العلاوات والخصومات */}
        <div className={styles.tableContainer}>
            <table>
                <thead>
                    <tr>
                    <th>التاريخ</th>
                    <th>النوع</th>
                    <th>القيمة</th>
                    <th>الملاحظة</th>
                    <th>التحكم</th>
                    </tr>
                </thead>
                <tbody>
                    {adjustments.length > 0 ? (
                    adjustments.map((adj) => (
                        <tr key={adj.id}>
                        <td>
                            {adj.date?.toDate
                            ? adj.date.toDate().toLocaleDateString()
                            : new Date(adj.date).toLocaleDateString()}
                        </td>
                        <td>{adj.type === "bonus" ? "علاوة" : "خصم"}</td>
                        <td>{adj.value} جنيه</td>
                        <td>{adj.note || "-"}</td>
                        <td>
                            <button
                            onClick={() => handleEdit(adj)}
                            className={styles.editButton}
                            >
                            ✏️ تعديل
                            </button>
                            <button
                            onClick={() => handleDelete(adj.id)}
                            className={styles.deleteButton}
                            >
                            🗑️ حذف
                            </button>
                        </td>
                        </tr>
                    ))
                    ) : (
                    <tr>
                        <td colSpan="5">لا توجد خصومات أو علاوات بعد</td>
                    </tr>
                    )}
                </tbody>
            </table>
        </div>

        {/* ✅ Popup */}
        {showPopup && (
          <div className={styles.popupOverlay}>
            <div className={styles.popup}>
              <h3>{editId ? "تعديل العملية" : "إضافة خصم أو علاوة"}</h3>
              <label>النوع:</label>
              <select
                value={adjustType}
                onChange={(e) => setAdjustType(e.target.value)}
              >
                <option value="bonus">علاوة</option>
                <option value="deduction">خصم</option>
              </select>

              <label>القيمة:</label>
              <input
                type="number"
                value={adjustValue}
                onChange={(e) => setAdjustValue(e.target.value)}
              />

              <label>الملاحظة:</label>
              <textarea
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
              ></textarea>

              <div className={styles.popupButtons}>
                <button onClick={handleSaveAdjustment}>
                  {editId ? "تحديث" : "حفظ"}
                </button>
                <button onClick={() => {
                  setShowPopup(false);
                  setEditId(null);
                }}>
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmployeeReports;
