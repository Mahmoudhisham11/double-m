'use client';
import SideBar from "@/components/SideBar/page";
import styles from "./styles.module.css";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export default function DailyReports() {

  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [totalQty, setTotalQty] = useState(0);

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

  return (
    <div className={styles.DailyReports}>
      <SideBar />

      <div className={styles.content}>
        
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="ابحث عن منتج..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* عرض الإجمالي */}
        <div className={styles.totals}>
          <p>إجمالي الكمية: {totalQty}</p>
        </div>

        {/* جدول عرض النتائج */}
        <div className={styles.tableContainer}>
          <table>
            <thead>
              <tr>
                <th>الكود</th>
                <th>الاسم</th>
                <th>سعر الشراء</th>
                <th>سعر البيع</th>
                <th>الكمية</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const qty = p.colors?.length
                  ? computeTotalQtyFromColors(p.colors)
                  : Number(p.quantity || 0);

                return (
                  <tr key={p.id}>
                    <td>{p.code}</td>
                    <td>{p.name}</td>
                    <td>{p.buyPrice} EGP</td>
                    <td>{p.sellPrice} EGP</td>
                    <td>{qty}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
