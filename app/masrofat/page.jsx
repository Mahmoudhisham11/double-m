'use client';
import SideBar from "@/components/SideBar/page";
import styles from "./styles.module.css";
import { useEffect, useState } from "react";
import { FaTrashAlt } from "react-icons/fa";
import { addDoc, collection, deleteDoc, doc, onSnapshot, getDocs, query, where } from "firebase/firestore";
import { db } from "@/app/firebase";
import { GiReceiveMoney } from "react-icons/gi";
import { FaQuestion } from "react-icons/fa";
import { useRouter } from "next/navigation";

function Masrofat() {
  const router = useRouter();
  const [auth, setAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(false);
  const [masrof, setMasrof] = useState("");
  const [reason, setReason] = useState("");
  const [shop, setShop] = useState("");
  const [masrofatList, setMasrofatList] = useState([]);
  const [dailySales, setDailySales] = useState(0); // إجمالي المبيعات اليومية

  // التحقق من الصلاحيات
  useEffect(() => {
    const checkLock = async () => {
      const userName = localStorage.getItem("userName");
      if (!userName) {
        router.push("/");
        return;
      }
      const q = query(collection(db, "users"), where("userName", "==", userName));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const user = querySnapshot.docs[0].data();
        if (user.permissions?.masrofat === true) {
          alert("ليس لديك الصلاحية للوصول إلى هذه الصفحة❌");
          router.push("/");
          return;
        } else {
          setAuth(true);
        }
      } else {
        router.push("/");
        return;
      }
      setLoading(false);
    };
    checkLock();
  }, []);

  // عرض بيانات المصروفات من Firestore
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storageShop = localStorage.getItem("shop");
      setShop(storageShop);

      const q = query(collection(db, "masrofat"), where("shop", "==", storageShop));
      const unsub = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setMasrofatList(data);
      });

      return () => unsub();
    }
  }, []);

  // جلب المبيعات اليومية من dailySales
  useEffect(() => {
    if (!shop) return;

    const getTodaySales = async () => {
      try {
        const q = query(collection(db, "dailySales"), where("shop", "==", shop));
        const querySnapshot = await getDocs(q);
        let total = 0;
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          total += Number(data.total || 0);
        });
        setDailySales(total);
      } catch (error) {
        console.error("خطأ أثناء جلب المبيعات اليومية:", error);
      }
    };

    getTodaySales();
  }, [shop, masrofatList]);

  // إضافة مصروف جديد
  const handleAddMasrof = async () => {
    if (!masrof || !reason) {
      alert("يرجى ملء كل الحقول");
      return;
    }

    const masrofValue = Number(masrof);

    // حساب إجمالي المصاريف الحالية
    const totalMasrofToday = masrofatList.reduce((acc, item) => acc + Number(item.masrof || 0), 0);
    const availableAmount = dailySales - totalMasrofToday;

    // تحقق من الرصيد المتاح
    if (masrofValue > availableAmount) {
      alert(`❌ الرصيد الحالي غير كافٍ لإضافة هذا المصروف.
      
الرصيد المتاح: ${availableAmount}
المبلغ المطلوب: ${masrofValue}`);
      return;
    }

    try {
      const now = new Date();
      const formattedDate = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1)
        .toString()
        .padStart(2, "0")}/${now.getFullYear()}`;

      // إضافة المصروف في Collection masrofat
      await addDoc(collection(db, "masrofat"), {
        masrof: masrofValue,
        reason,
        date: formattedDate,
        shop,
      });

      // تحقق إذا السبب هو ربح مصطفى أو ربح ميدو
      let person = null;
      if (reason.includes("ربح مصطفى")) person = "مصطفى";
      else if (reason.includes("ربح ميدو")) person = "ميدو";

      if (person) {
        // إضافة السحب في Collection withdraws
        await addDoc(collection(db, "withdraws"), {
          shop,
          person,
          amount: masrofValue,
          date: formattedDate,
        });
      }

      // تفريغ الحقول بعد الإضافة
      setMasrof("");
      setReason("");
      setActive(false);
    } catch (error) {
      console.error("خطأ أثناء الإضافة:", error);
    }
  };

  // حذف مصروف واحد
  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "masrofat", id));
    } catch (error) {
      console.error("خطأ أثناء الحذف:", error);
    }
  };

  // حساب إجمالي المصروفات
  const totalMasrof = masrofatList.reduce((acc, item) => acc + Number(item.masrof || 0), 0);
  const totalAvailable = dailySales - totalMasrof;

  if (loading) return <p>🔄 جاري التحقق...</p>;
  if (!auth) return null;

  return (
    <div className={styles.masrofat}>
      <SideBar />
      <div className={styles.content}>
        <div className={styles.btns}>
          <button onClick={() => setActive(!active)}>اضف مصاريف جديدة</button>
        </div>

        <div className={styles.total}>
          <h2>إجمالي المصروفات: {totalMasrof}</h2>
          <h3>الإجمالي المتاح اليوم: {totalAvailable}</h3>
        </div>

        {/* جدول المصروفات */}
        <div className={styles.masrofatContent} style={{ display: active ? "none" : "flex" }}>
          <div className={styles.tableContainer}>
            <table>
              <thead>
                <tr>
                  <th>المصروف</th>
                  <th>السبب</th>
                  <th>التاريخ</th>
                  <th>حذف</th>
                </tr>
              </thead>
              <tbody>
                {masrofatList.map((item) => (
                  <tr key={item.id}>
                    <td>{item.masrof}</td>
                    <td>{item.reason}</td>
                    <td>{item.date}</td>
                    <td>
                      <button className={styles.delBtn} onClick={() => handleDelete(item.id)}>
                        <FaTrashAlt />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* إضافة مصروف جديد */}
        <div className={styles.addMasrofat} style={{ display: active ? "flex" : "none" }}>
          <div className="inputContainer">
            <label><GiReceiveMoney /></label>
            <input type="number" value={masrof} onChange={(e) => setMasrof(e.target.value)} />
          </div>
          <div className="inputContainer">
            <label><FaQuestion /></label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <button className={styles.addBtn} onClick={handleAddMasrof}>اضف المصروف</button>
        </div>
      </div>
    </div>
  );
}

export default Masrofat;
