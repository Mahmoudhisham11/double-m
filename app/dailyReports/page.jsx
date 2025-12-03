"use client";
import SideBar from "@/components/SideBar/page";
import styles from "./styles.module.css";
import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
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

  useEffect(() => {
    const shop = localStorage.getItem("shop");
    if (!shop) return;

    const q = query(
      collection(db, "lacosteProducts"),
      where("shop", "==", shop),
      where("type", "==", "product")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setProducts(data);
      setFiltered(data);
      setTotalQty(computeTotalProducts(data));
    });

    return () => unsubscribe();
  }, []);

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
        {/* -- شريط البحث -- */}
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

        <button
          onClick={() => {
            if (typeof window !== "undefined") {
              const table = document.getElementById("productsTable");
              if (!table) return;

              const printWindow = window.open("", "", "width=900,height=650");
              printWindow.document.write(`
                <html>
                  <head>
                    <title>طباعة المنتجات</title>
                    <style>
                      table { width: 100%; border-collapse: collapse; }
                      th, td { border: 1px solid #000; padding: 8px; text-align: left; }
                    </style>
                  </head>
                  <body>${table.outerHTML}</body>
                </html>
              `);
              printWindow.document.close();
              printWindow.focus();
              printWindow.print();
              // شيل printWindow.close() عشان النافذة متتقفلش على طول
            }
          }}
          style={{
            padding: "8px 12px",
            marginBottom: "12px",
            background: "#ffd400",
            border: "none",
            borderRadius: 6,
          }}
        >
          طباعة المنتجات
        </button>

        {/* ✔ عرض إجمالي الكمية */}
        <div className={styles.totals}>
          <h2>إجمالي الكمية: {totalQty}</h2>
        </div>

        {/* ✔ جدول المنتجات */}
        <div className={styles.tableContainer}>
          <table id="productsTable">
            <thead>
              <tr>
                <th>الكود</th>
                <th>الاسم</th>
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
