'use client';
import styles from "./styles.module.css";
import SideBar from "@/components/SideBar/page";
import { useEffect, useState } from "react";
import {
  doc,
  collection,
  getDoc,
  setDoc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  Timestamp
} from "firebase/firestore";
import { db } from "@/app/firebase";
import { useRouter } from "next/navigation";

export default function Balance() {
  const router = useRouter();
  const [shop, setShop] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const s = localStorage.getItem("shop");
      setShop(s);
    }
  }, []);

  const [activeTab, setActiveTab] = useState("main");
  const [balances, setBalances] = useState({
    main: 0,
    phones: 0,
    accessories: 0,
    maintenance: 0,
  });

  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Popups state
  const [showBalancePopup, setShowBalancePopup] = useState(false);
  const [balanceDirection, setBalanceDirection] = useState("increase");
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceNote, setBalanceNote] = useState("");
  const [editingBalance, setEditingBalance] = useState(false);

  const [showOperationPopup, setShowOperationPopup] = useState(false);
  const [operationAmount, setOperationAmount] = useState("");
  const [operationNote, setOperationNote] = useState("");
  const [editingOperationId, setEditingOperationId] = useState(null);

  const tabLabels = {
    main: "الرصيد العام",
    phones: "رصيد الموبايلات",
    accessories: "رصيد الاكسسوار",
    maintenance: "رصيد الصيانة",
  };

  useEffect(() => {
    if (!shop) {
      console.warn("shop not found in localStorage");
      return;
    }

    const balancesDocRef = doc(db, "balances", shop);

    const ensureDoc = async () => {
      const snap = await getDoc(balancesDocRef);
      if (!snap.exists()) {
        await setDoc(balancesDocRef, {
          shop,
          main: 0,
          phones: 0,
          accessories: 0,
          maintenance: 0
        });
      }
    };

    ensureDoc().catch(console.error);

    const unsubBalances = onSnapshot(balancesDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setBalances({
          main: Number(data.main || 0),
          phones: Number(data.phones || 0),
          accessories: Number(data.accessories || 0),
          maintenance: Number(data.maintenance || 0),
        });
      } else {
        setBalances({ main: 0, phones: 0, accessories: 0, maintenance: 0 });
      }
      setLoading(false);
    }, (err) => {
      console.error("balances onSnapshot error:", err);
      setLoading(false);
    });

    const opsQuery = query(collection(db, "balanceOperations"), where("shop", "==", shop));
    const unsubOps = onSnapshot(opsQuery, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => {
        const ta = a.date?.toDate ? a.date.toDate().getTime() : (a.date?.seconds ? a.date.seconds * 1000 : 0);
        const tb = b.date?.toDate ? b.date.toDate().getTime() : (b.date?.seconds ? b.date.seconds * 1000 : 0);
        return tb - ta;
      });
      setOperations(data);
    }, (err) => console.error("operations onSnapshot error:", err));

    return () => {
      unsubBalances();
      unsubOps();
    };
  }, [shop]);

  const handleSaveOperation = async () => {
    if (!shop) {
      alert("المحل غير معروف، الرجاء إعادة الدخول");
      return;
    }
    if (!operationAmount || isNaN(operationAmount) || Number(operationAmount) <= 0) {
      alert("أدخل قيمة صحيحة للكمية");
      return;
    }

    const amt = Number(operationAmount);
    const type = activeTab; // ✅ نستخدم نوع التبويب الحالي تلقائياً
    try {
      if (editingOperationId) {
        const ref = doc(db, "balanceOperations", editingOperationId);
        await updateDoc(ref, {
          type,
          amount: amt,
          note: operationNote || "",
          date: Timestamp.now(),
        });
        alert("تم تحديث العملية بنجاح ✅");
      } else {
        await addDoc(collection(db, "balanceOperations"), {
          shop,
          type,
          direction: "increase", // افتراضياً العملية تعتبر زيادة فقط
          amount: amt,
          note: operationNote || "عملية جديدة",
          date: Timestamp.now(),
          createdBy: localStorage.getItem("userName") || null,
        });
        alert("تم إضافة العملية بنجاح ✅");
      }

      setOperationAmount("");
      setOperationNote("");
      setEditingOperationId(null);
      setShowOperationPopup(false);
    } catch (err) {
      console.error("save operation error:", err);
      alert("حدث خطأ أثناء حفظ العملية");
    }
  };

  const handleDeleteOperation = async (opId) => {
    const confirmDelete = window.confirm("هل أنت متأكد من حذف هذه العملية؟");
    if (!confirmDelete) return;

    try {
      const opRef = doc(db, "balanceOperations", opId);
      const opSnap = await getDoc(opRef);

      if (opSnap.exists()) {
        const op = opSnap.data();
        const docRef = doc(db, "balances", shop);
        const balSnap = await getDoc(docRef);
        if (balSnap.exists()) {
          const current = Number(balSnap.data()[op.type] || 0);
          let newValue = current;
          if (op.direction === "increase") newValue -= op.amount;
          else if (op.direction === "decrease") newValue += op.amount;
          await updateDoc(docRef, { [op.type]: newValue });
        }
      }

      await deleteDoc(opRef);
      alert("تم حذف العملية وتعديل الرصيد ✅");
    } catch (err) {
      console.error("delete operation error:", err);
      alert("حدث خطأ أثناء الحذف");
    }
  };

  const handleEditOperation = (op) => {
    setEditingOperationId(op.id);
    setOperationAmount(op.amount);
    setOperationNote(op.note || "");
    setShowOperationPopup(true);
  };

  const handleSaveBalanceChange = async () => {
    if (!shop) {
      alert("المحل غير معروف");
      return;
    }
    if (!balanceAmount || isNaN(balanceAmount) || Number(balanceAmount) <= 0) {
      alert("أدخل قيمة صحيحة");
      return;
    }
    const amt = Number(balanceAmount);
    const field = activeTab;
    const docRef = doc(db, "balances", shop);

    try {
      const snap = await getDoc(docRef);
      let current = 0;
      if (snap.exists()) {
        const data = snap.data();
        current = Number(data[field] || 0);
      } else {
        await setDoc(docRef, { shop, main: 0, phones: 0, accessories: 0, maintenance: 0 });
        current = 0;
      }

      const newValue = balanceDirection === "increase" ? current + amt : current - amt;
      await updateDoc(docRef, { [field]: newValue });

      await addDoc(collection(db, "balanceOperations"), {
        shop,
        type: field,
        direction: balanceDirection,
        amount: amt,
        note: balanceNote || (balanceDirection === "increase" ? "زيادة رصيد" : "خصم من الرصيد"),
        date: Timestamp.now(),
        createdBy: localStorage.getItem("userName") || null,
      });

      alert("تم تطبيق التعديل على الرصيد ✅");
      setBalanceAmount("");
      setBalanceNote("");
      setBalanceDirection("increase");
      setShowBalancePopup(false);
    } catch (err) {
      console.error("save balance change error:", err);
      alert("حدث خطأ أثناء تحديث الرصيد");
    }
  };

  if (!shop) {
    return (
      <div className={styles.balance}>
        <SideBar />
        <div className={styles.content}>
          <p>جاري تحميل بيانات المحل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.balance}>
      <SideBar />
      <div className={styles.content}>
        <div className={styles.title}>
          <h2>الأرصدة</h2>
        </div>

        {/* Tabs */}
        <div className={styles.tabsRow}>
          {["main"].map((t) => (
            <button
              key={t}
              className={`${styles.tabBtn} ${activeTab === t ? styles.activeTab : ""}`}
              onClick={() => setActiveTab(t)}
            >
              {tabLabels[t]}
            </button>
          ))}
        </div>

        {/* Card */}
        <div className={styles.balanceCardRow}>
          <div className={styles.balanceCard}>
            <h3>{tabLabels[activeTab]}</h3>
            <p className={styles.balanceValue}>
              {loading ? "جاري التحميل..." : (balances[activeTab] ?? 0) + " جنيه"}
            </p>
            <div className={styles.cardActions}>
              <button
                className={styles.primaryBtn}
                onClick={() => {
                  setBalanceDirection("increase");
                  setBalanceAmount("");
                  setBalanceNote("");
                  setShowBalancePopup(true);
                }}
              >
                تعديل الرصيد
              </button>

              <button
                className={styles.secondaryBtn}
                onClick={() => {
                  setOperationAmount("");
                  setOperationNote("");
                  setEditingOperationId(null);
                  setShowOperationPopup(true);
                }}
              >
                إضافة عملية
              </button>

              <button
                className={styles.dangerBtn}
                onClick={async () => {
                  const confirmAll = window.confirm(`هل تريد حذف جميع العمليات من نوع "${tabLabels[activeTab]}"؟`);
                  if (!confirmAll) return;
                  try {
                    const q = query(collection(db, "balanceOperations"), where("shop", "==", shop), where("type", "==", activeTab));
                    const snap = await getDocs(q);
                    if (snap.empty) {
                      alert("لا توجد عمليات للحذف");
                      return;
                    }
                    for (const ds of snap.docs) {
                      await deleteDoc(doc(db, "balanceOperations", ds.id));
                    }
                    alert("تم حذف جميع العمليات ✅");
                  } catch (err) {
                    console.error("delete all operations error:", err);
                    alert("حدث خطأ أثناء الحذف");
                  }
                }}
              >
                حذف كل العمليات لهذا النوع
              </button>
            </div>
          </div>
        </div>

        {/* جدول العمليات */}
        <div className={styles.operationsTable}>
          <h4>سجل العمليات ({tabLabels[activeTab]})</h4>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>الاتجاه</th>
                  <th>القيمة</th>
                  <th>الملاحظة</th>
                  <th>المستخدم</th>
                  <th>التحكم</th>
                </tr>
              </thead>
              <tbody>
                {operations.filter(op => op.type === activeTab).length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: "center", padding: 20 }}>
                      لا توجد عمليات لهذا النوع
                    </td>
                  </tr>
                ) : (
                  operations
                    .filter(op => op.type === activeTab)
                    .map((op) => {
                      const dateStr = op.date?.toDate ? op.date.toDate().toLocaleString("ar-EG") :
                        op.date?.seconds ? new Date(op.date.seconds * 1000).toLocaleString("ar-EG") : "-";
                      return (
                        <tr key={op.id}>
                          <td>{dateStr}</td>
                          <td>{op.direction === "increase" ? "زيادة" : (op.direction === "decrease" ? "خصم" : "-")}</td>
                          <td>{op.amount} جنيه</td>
                          <td>{op.note || "-"}</td>
                          <td>{op.createdBy || "-"}</td>
                          <td>
                            <button className={styles.editBtn} onClick={() => handleEditOperation(op)}>تعديل</button>
                            <button className={styles.deleteBtn} onClick={() => handleDeleteOperation(op.id)}>حذف</button>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Popup: تعديل الرصيد */}
        {showBalancePopup && (
          <div className={styles.popupOverlay}>
            <div className={styles.popup}>
              <h3>تعديل {tabLabels[activeTab]}</h3>

              <label>نوع التعديل:</label>
              <div className={styles.row}>
                <label>
                  <input
                    type="radio"
                    name="balDir"
                    value="increase"
                    checked={balanceDirection === "increase"}
                    onChange={() => setBalanceDirection("increase")}
                  />
                  زيادة
                </label>
                <label style={{ marginLeft: 12 }}>
                  <input
                    type="radio"
                    name="balDir"
                    value="decrease"
                    checked={balanceDirection === "decrease"}
                    onChange={() => setBalanceDirection("decrease")}
                  />
                  خصم
                </label>
              </div>

              <label>القيمة:</label>
              <input
                type="number"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                placeholder="المبلغ"
              />

              <label>ملاحظة (اختياري):</label>
              <textarea
                value={balanceNote}
                onChange={(e) => setBalanceNote(e.target.value)}
                placeholder="سبب التعديل..."
              />

              <div className={styles.popupActions}>
                <button className={styles.primaryBtn} onClick={handleSaveBalanceChange}>
                  حفظ
                </button>
                <button className={styles.secondaryBtn} onClick={() => setShowBalancePopup(false)}>
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Popup: إضافة / تعديل عملية */}
        {showOperationPopup && (
          <div className={styles.popupOverlay}>
            <div className={styles.popup}>
              <h3>{editingOperationId ? "تعديل العملية" : "إضافة عملية"}</h3>

              <label>القيمة:</label>
              <input
                type="number"
                value={operationAmount}
                onChange={(e) => setOperationAmount(e.target.value)}
                placeholder="المبلغ"
              />

              <label>ملاحظة:</label>
              <textarea
                value={operationNote}
                onChange={(e) => setOperationNote(e.target.value)}
                placeholder="تفاصيل العملية"
              />

              <div className={styles.popupActions}>
                <button className={styles.primaryBtn} onClick={handleSaveOperation}>
                  {editingOperationId ? "تحديث" : "حفظ"}
                </button>
                <button
                  className={styles.secondaryBtn}
                  onClick={() => { setShowOperationPopup(false); setEditingOperationId(null); }}
                >
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
