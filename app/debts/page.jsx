'use client';
import SideBar from "@/components/SideBar/page";
import styles from "./styles.module.css";
import { useEffect, useState } from "react";
import { CiSearch, CiPhone } from "react-icons/ci";
import { FaRegTrashAlt } from "react-icons/fa";
import { GiMoneyStack } from "react-icons/gi";
import { MdDriveFileRenameOutline } from "react-icons/md";
import { db } from "@/app/firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc
} from "firebase/firestore";
import { useRouter } from "next/navigation";

function Debts() {
  const router = useRouter()
  const [auth, setAuth] = useState(false)
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(false);
  const [searchCode, setSearchCode] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    debt: "",
    debtType: "",
    debtDirection: "",
    dateInput: "",
  });
  const [customers, setCustomers] = useState([]);

  // --- payment modal state (NEW)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentCustomer, setPaymentCustomer] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  const shop =
    typeof window !== "undefined" ? localStorage.getItem("shop") : "";

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
          if(user.permissions?.debts === true) {
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

  useEffect(() => {
    if (!shop) return;
    // ✅ جلب العملاء حسب الـ shop فقط
    const q = query(collection(db, "debts"), where("shop", "==", shop));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setCustomers(data);
    });

    return () => unsubscribe();
  }, [shop]);

  const handleAddProduct = async () => {
    if (
      !form.name ||
      !form.phone
    ) {
      alert("يرجى ملء كل الحقول");
      return;
    }

    await addDoc(collection(db, "debts"), {
      name: form.name,
      phone: form.phone,
      debt: Number(form.debt),
      debtType: form.debtType,
      debtDirection: form.debtDirection,
      dateInput: form.dateInput,
      date: new Date(),
      shop: shop,
    });

    setForm({
      name: "",
      phone: "",
      debt: "",
      debtType: "",
      debtDirection: "",
      dateInput: "",
    });
    setActive(false);
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, "debts", id));
  };

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(searchCode.toLowerCase())
  );

  // ===== New: open payment modal for a customer
  const openPaymentModal = (customer) => {
    setPaymentCustomer(customer);
    setPaymentAmount(""); // reset
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentCustomer(null);
    setPaymentAmount("");
    setProcessingPayment(false);
  };

  // ===== New: handle confirming the payment
  const handleConfirmPayment = async () => {
    if (!paymentCustomer) return;
    const paid = Number(paymentAmount);
    if (!paid || paid <= 0 || isNaN(paid)) {
      alert("الرجاء إدخال مبلغ سداد صالح أكبر من صفر");
      return;
    }

    setProcessingPayment(true);

    try {
      const debtRef = doc(db, "debts", paymentCustomer.id);
      const debtSnap = await getDoc(debtRef);

      if (!debtSnap.exists()) {
        alert("لم يتم العثور على بيانات الدين — ربما حُذف بالفعل.");
        setProcessingPayment(false);
        closePaymentModal();
        return;
      }

      const debtData = debtSnap.data();
      const previousDebt = Number(debtData.debt || 0);
      if (paid > previousDebt) {
        alert(`المبلغ أكبر من الدين الحالي (${previousDebt} EGP). الرجاء إدخال مبلغ مناسب أو خصم الفارق.`);
        setProcessingPayment(false);
        return;
      }

      const remainingDebt = previousDebt - paid;

      // update or delete debt doc
      if (remainingDebt <= 0) {
        // حذف المستند لأن الدين سدد بالكامل
        await deleteDoc(debtRef);
      } else {
        // تحديث قيمة الدين
        await updateDoc(debtRef, { debt: remainingDebt });
      }

      // تسجيل الدفعة في collection جديدة: debtsPayments
      await addDoc(collection(db, "debtsPayments"), {
        name: debtData.name || paymentCustomer.name || "",
        phone: debtData.phone || paymentCustomer.phone || "",
        paidAmount: paid,
        previousDebt: previousDebt,
        remainingDebt: remainingDebt,
        date: new Date(),
        shop: shop,
      });

      alert("✅ تم تسجيل السداد وتحديث الدين بنجاح");
      // refresh local state handled by onSnapshot listener
      closePaymentModal();
    } catch (err) {
      console.error("خطأ أثناء معالجة السداد:", err);
      alert("❌ حدث خطأ أثناء معالجة السداد، حاول مرة أخرى");
      setProcessingPayment(false);
    }
  };

  if (loading) return <p>🔄 جاري التحقق...</p>;
  if (!auth) return null;

  return (
    <div className={styles.debts}>
      <SideBar />
      <div className={styles.content}>
        <div className={styles.btns}>
          <button onClick={() => setActive(false)}>كل العملاء</button>
          <button onClick={() => setActive(true)}>اضف عميل جديد</button>
        </div>

        {/* ✅ عرض العملاء */}
        <div
          className={styles.phoneContainer}
          style={{ display: active ? "none" : "flex" }}
        >
          <div className={styles.searchBox}>
            <div className="inputContainer">
              <label>
                <CiSearch />
              </label>
              <input
                type="text"
                list="code"
                placeholder="ابحث بالاسم"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
              />
              <datalist id="code">
                {customers.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>
          </div>

          <div className={styles.tableContainer}>
            <table>
              <thead>      
                <tr>
                  <th>الاسم</th>
                  <th>رقم الهاتف</th>
                  <th>الدين</th>
                  <th>نوع الدين</th>
                  <th>الدين لمين</th>
                  <th>تاريخ الدين</th>
                  <th>تاريخ الإضافة</th>
                  <th>سداد</th>
                  <th>حذف</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>{customer.name}</td>
                    <td>{customer.phone}</td>
                    <td>{customer.debt} EGP</td>
                    <td>{customer.debtType}</td>
                    <td>{customer.debtDirection}</td>
                    <td>{customer.dateInput}</td>
                    <td>
                      {customer.date?.toDate().toLocaleDateString("ar-EG")}
                    </td>
                    <td>
                      {/* NEW: سداد button */}
                      <button
                        className={styles.payBtn}
                        onClick={() => openPaymentModal(customer)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "none",
                          background: "#198754",
                          color: "white",
                          cursor: "pointer",
                          transition: "transform .12s ease"
                        }}
                        onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.98)"}
                        onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
                      >
                        سداد
                      </button>
                    </td>
                    <td>
                      <button
                        className={styles.delBtn}
                        onClick={() => {
                          const ok = confirm("هل تريد حذف سجل هذا العميل؟");
                          if (ok) handleDelete(customer.id);
                        }}
                      >
                        <FaRegTrashAlt />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ✅ إضافة عميل */}
        <div
          className={styles.addContainer}
          style={{ display: active ? "flex" : "none" }}
        >
          <div className={styles.inputBox}>
            <div className="inputContainer">
              <label>
                <MdDriveFileRenameOutline />
              </label>
              <input
                type="text"
                placeholder="اسم العميل"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.inputBox}>
            <div className="inputContainer">
              <label>
                <CiPhone />
              </label>
              <input
                type="text"
                placeholder="رقم الهاتف"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>

            <div className="inputContainer">
              <label>
                <GiMoneyStack />
              </label>
              <input
                type="number"
                placeholder="الدين"
                value={form.debt}
                onChange={(e) => setForm({ ...form, debt: e.target.value })}
              />
            </div>


          </div>

          <div className={styles.inputBox}>
            <div className="inputContainer">
              <input
                type="date"
                value={form.dateInput}
                onChange={(e) => setForm({ ...form, dateInput: e.target.value })}
              />
            </div>

            <div className="inputContainer">
              <label>
                <GiMoneyStack />
              </label>
              <select
                value={form.debtDirection}
                onChange={(e) =>
                  setForm({ ...form, debtDirection: e.target.value })
                }
              >
                <option value="">الدين لمين</option>
                <option value="ليك">ليك</option>
                <option value="بضاعة اجل">بضاعة اجل</option>
              </select>
            </div>
          </div>

          <button className={styles.addBtn} onClick={handleAddProduct}>
            اضف العميل
          </button>
        </div>
      </div>

      {/* ===== Payment Modal (NEW) ===== */}
      {showPaymentModal && paymentCustomer && (
        <div
          // full screen overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16
          }}
          onClick={closePaymentModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(520px, 96%)",
              maxHeight: "90vh",
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              transform: processingPayment ? "scale(0.99)" : "scale(1)",
              transition: "all 200ms ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>سداد دين — {paymentCustomer.name}</h3>
              <button
                onClick={closePaymentModal}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 18,
                  cursor: "pointer"
                }}
                aria-label="close"
              >
                ✖
              </button>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 14, color: "#555" }}>
                الدين الحالي: <strong>{paymentCustomer.debt} EGP</strong>
              </div>

              <label style={{ fontSize: 13, color: "#333" }}>المبلغ الذي سُدِّد (جنيه)</label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="اكتب المبلغ"
                min="0"
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  outline: "none",
                  width: "100%",
                  boxSizing: "border-box"
                }}
              />

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  onClick={closePaymentModal}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid #ccc",
                    background: "transparent",
                    cursor: "pointer"
                  }}
                >
                  إلغاء
                </button>
                <button
                  onClick={handleConfirmPayment}
                  disabled={processingPayment}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "none",
                    background: "#0b5ed7",
                    color: "#fff",
                    cursor: "pointer",
                    boxShadow: "0 6px 16px rgba(11,94,215,0.18)"
                  }}
                >
                  {processingPayment ? "جاري الحفظ..." : "تأكيد السداد"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Debts;
