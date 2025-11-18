'use client';
import SideBar from "@/components/SideBar/page";
import styles from "./styles.module.css";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function DailyReports() {

  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [totalQty, setTotalQty] = useState(0);

  // ⭐ حالات المصاريف
  const [showMasrof, setShowMasrof] = useState(false); // التبديل بين المنتجات والمصاريف
  const [masrofDate, setMasrofDate] = useState(""); // بحث بالتاريخ type="date"
  const [masrofData, setMasrofData] = useState([]);
  const [masrofTotal, setMasrofTotal] = useState(0);

  // دالة حساب كمية منتج واحد (حسب الألوان والمقاسات)
  const computeTotalQtyFromColors = (colorsArr) => {
    let total = 0;
    if (!Array.isArray(colorsArr)) return 0;
    colorsArr.forEach((c) => {
      if (Array.isArray(c.sizes)) {
        c.sizes.forEach((s) => {
          total += Number(s.qty || 0);
        });
      } else if (c.quantity) {
        total += Number(c.quantity || 0);
      }
    });
    return total;
  };

  // دالة حساب إجمالي كل المنتجات بعد الفلترة
  const computeTotalProducts = (arr) => {
    let total = 0;
    arr.forEach((product) => {
      if (product.colors && product.colors.length) {
        total += computeTotalQtyFromColors(product.colors);
      } else {
        total += Number(product.quantity || 0);
      }
    });
    return total;
  };

  // قراءة المنتجات من Firestore
  useEffect(() => {
    const shop = localStorage.getItem("shop");
    if (!shop) return;

    const q = query(
      collection(db, "lacosteProducts"),
      where("shop", "==", shop),
      where("type", "==", "product")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setProducts(data);
      setFiltered(data);
      setTotalQty(computeTotalProducts(data));
    });

    return () => unsubscribe();
  }, []);

  // البحث + الفلترة + تحديث الإجمالي
  useEffect(() => {
    let result;

    if (search.trim()) {
      result = products.filter((p) =>
        p.name?.toLowerCase().includes(search.toLowerCase())
      );
    } else {
      result = products;
    }

    setFiltered(result);
    setTotalQty(computeTotalProducts(result));
  }, [search, products]);


  // ⭐ جلب مصاريف التاريخ المحدد
  const loadMasrofByDate = (dateString) => {
    const shop = localStorage.getItem("shop");
    if (!shop || !dateString) return;

    // تحويل التاريخ إلى شكل "DD/MM/YYYY"
    const d = new Date(dateString);
    const formatted = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

    const q = query(
      collection(db, "masrofatHistory"),
      where("shop", "==", shop),
      where("date", "==", formatted)
    );

    onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMasrofData(data);

      let total = 0;
      data.forEach((m) => {
        total += Number(m.masrof || 0);
      });

      setMasrofTotal(total);
    });
  };

  // ⭐ عند تغيير التاريخ
  const handleMasrofDateChange = (e) => {
    const date = e.target.value;
    setMasrofDate(date);
    loadMasrofByDate(date);
  };

  // ⭐ زر إظهار/إخفاء المصاريف
  // ⭐ زر إظهار/إخفاء المصاريف
const toggleMasrof = () => {
  const newState = !showMasrof;
  setShowMasrof(newState);

  // ⭐ إذا تم فتح وضع المصاريف → تحميل مصاريف تاريخ اليوم مباشرة
  if (!showMasrof) {
    const today = new Date();
    const formattedInputDate = today.toISOString().split("T")[0]; // yyyy-mm-dd
    setMasrofDate(formattedInputDate);
    loadMasrofByDate(formattedInputDate);
  }
};
// ⭐ حذف مصروف
const deleteMasrof = async (id) => {
  try {
    await deleteDoc(doc(db, "masrofatHistory", id));
  } catch (error) {
    console.log("Error deleting masrof:", error);
  }
};



  return (
    <div className={styles.DailyReports}>
      <SideBar />

      <div className={styles.content}>
        
        {/* -- شريط البحث لو المنتجات ظاهرة فقط -- */}
        {!showMasrof && (
          <div className={styles.searchBox}>
            <div className="inputContainer">
              <input
                type="text"
                placeholder="ابحث عن منتج..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* ✔ زرار عرض/إخفاء المصاريف */}
        <button 
          onClick={toggleMasrof}
          style={{ marginTop: "20px", padding: "10px 20px", cursor: "pointer" }}
        >
          {showMasrof ? "عرض المنتجات" : "عرض المصاريف"}
        </button>

        {/* ✔ حقل التاريخ يظهر فقط في وضع المصاريف */}
        {showMasrof && (
          <div style={{ marginTop: "20px" }}>
            <input
              type="date"
              value={masrofDate}
              onChange={handleMasrofDateChange}
            />
          </div>
        )}

        {/* ✔ عرض الإجمالي */}
        <div className={styles.totals}>
          {showMasrof ? (
            <h2>إجمالي المصروفات: {masrofTotal} جنيه</h2>
          ) : (
            <h2>إجمالي الكمية: {totalQty}</h2>
          )}
        </div>

        {/* ✔ جدول موحد */}
        <div className={styles.tableContainer}>
          <table>
            <thead>
              {!showMasrof ? (
                <tr>
                  <th>الكود</th>
                  <th>الاسم</th>
                  <th>الكمية</th>
                </tr>
              ) : (
                <tr>
                  <th>السبب</th>
                  <th>المبلغ</th>
                  <th>التاريخ</th>
                  <th>حذف</th>
                </tr>
              )}
            </thead>

            <tbody>
              {!showMasrof
                ? filtered.map((p) => {
                    const qty = p.colors?.length
                      ? computeTotalQtyFromColors(p.colors)
                      : Number(p.quantity || 0);

                    return (
                      <tr key={p.id}>
                        <td>{p.code}</td>
                        <td>{p.name}</td>
                        <td>{qty}</td>
                      </tr>
                    );
                  })
                : masrofData.map((m) => (
                    <tr key={m.id}>
                      <td>{m.reason}</td>
                      <td>{m.masrof}</td>
                      <td>{m.date}</td>
                      <td>
                        <button 
                          onClick={() => deleteMasrof(m.id)} 
                          style={{
                            padding: "5px 10px",
                            background: "red",
                            color: "white",
                            border: "none",
                            cursor: "pointer",
                            borderRadius: "5px"
                          }}
                        >
                          حذف
                        </button>
                      </td>
                    </tr>

                  ))
              }
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
