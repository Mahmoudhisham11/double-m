'use client';
import SideBar from "@/components/SideBar/page";
import styles from "./styles.module.css";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/app/firebase";

export default function CloseDay() {
  // states
  const [dateISO, setDateISO] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });

  const [closes, setCloses] = useState([]);
  const [selectedCloseIndex, setSelectedCloseIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showSales, setShowSales] = useState(true);

  // current user
  const [currentUser, setCurrentUser] = useState("");

useEffect(() => {
  const user = localStorage.getItem("userName") || "";
  setCurrentUser(user);
}, []);


  // helper: yyyy-mm-dd -> DD/MM/YYYY
  const toDDMMYYYY = (isoDate) => {
    if (!isoDate) return "";
    const [y, m, d] = isoDate.split("-");
    return `${d}/${m}/${y}`;
  };

  // helper: format time from Firestore Timestamp or fallback
  const timeFrom = (tsOrStr) => {
    if (!tsOrStr) return "-";
    if (tsOrStr?.toDate && typeof tsOrStr.toDate === "function") {
      return tsOrStr.toDate().toLocaleTimeString();
    }
    return typeof tsOrStr === "string" ? tsOrStr : "-";
  };

  // load closes for a given date (DD/MM/YYYY)
  useEffect(() => {
    const ddmmyyyy = toDDMMYYYY(dateISO);
    if (!ddmmyyyy) return;

    setLoading(true);
    const q = query(collection(db, "closeDayHistory"), where("closedAt", "==", ddmmyyyy));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a, b) => {
        const ta = a.closedAtTimestamp?.toDate ? a.closedAtTimestamp.toDate().getTime() : 0;
        const tb = b.closedAtTimestamp?.toDate ? b.closedAtTimestamp.toDate().getTime() : 0;
        return ta - tb;
      });
      setCloses(docs);
      setSelectedCloseIndex(docs.length ? 0 : -1);
      setLoading(false);
    }, (err) => {
      console.error("closeDayHistory onSnapshot error:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [dateISO]);

  const selectedClose = closes[selectedCloseIndex] || null;

  const totals = (() => {
    if (!selectedClose) return { totalSales: 0, totalExpenses: 0, net: 0 };
    const salesArr = Array.isArray(selectedClose.sales) ? selectedClose.sales : [];
    const masrofArr = Array.isArray(selectedClose.masrofat) ? selectedClose.masrofat : [];

    const totalSales = salesArr.reduce((sum, s) => {
      const v = Number(s.total ?? s.sum ?? 0);
      return sum + (isNaN(v) ? 0 : v);
    }, 0);

    const totalExpenses = masrofArr.reduce((sum, m) => {
      const v = Number(m.masrof ?? m.amount ?? 0);
      return sum + (isNaN(v) ? 0 : v);
    }, 0);

    const net = totalSales - totalExpenses;
    return { totalSales, totalExpenses, net };
  })();

  const renderSalesRows = (salesArr) => {
    if (!Array.isArray(salesArr) || salesArr.length === 0) {
      return <tr><td colSpan={currentUser === "mostafabeso10@gmail.com" ? 6 : 5} style={{ padding: 12 }}>لا توجد مبيعات في هذه التقفيلة</td></tr>;
    }

    return salesArr.map(sale => {
      const invoice = sale.invoiceNumber ?? sale.id ?? "-";
      const total = sale.total ?? sale.subtotal ?? 0;
      const profit = sale.profit ?? 0;
      const employee = sale.employee ?? sale.closedBy ?? "-";
      const date = sale.date?.toDate ? sale.date.toDate().toLocaleString() : (sale.date ? String(sale.date) : "-");

      return (
        <tr key={sale.id || invoice}>
          <td>{invoice}</td>
          <td>{employee}</td>
          <td>{date}</td>
          <td>{sale.cart ? sale.cart.map(i => i.name).join(", ") : "-"}</td>
          <td>{total}</td>
          {currentUser === "mostafabeso10@gmail.com" && <td>{profit}</td>}
        </tr>
      );
    });
  };

  const renderExpenseRows = (masrofArr) => {
    if (!Array.isArray(masrofArr) || masrofArr.length === 0) {
      return <tr><td colSpan={4} style={{ padding: 12 }}>لا توجد مصاريف في هذه التقفيلة</td></tr>;
    }

    return masrofArr.map(m => {
      const id = m.id || m.reason + Math.random();
      const date = m.date?.toDate ? m.date.toDate().toLocaleString() : (m.date ?? "-");
      const amount = m.masrof ?? m.amount ?? 0;
      const reason = m.reason ?? "-";
      const shop = m.shop ?? "-";
      return (
        <tr key={id}>
          <td>{reason}</td>
          <td>{shop}</td>
          <td>{date}</td>
          <td>{amount}</td>
        </tr>
      );
    });
  };

  return (
    <div className={styles.closeDay}>
      <SideBar />

      <div className={styles.content}>
        <h2>تقرير تقفيلات اليوم</h2>

        <div className={styles.controls} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
          <label>بحث بالتاريخ:</label>
          {currentUser === 'mostafabeso10@gmail.com' ? 
            <input
            type="date"
            value={dateISO}
            onChange={(e) => setDateISO(e.target.value)}
            style={{ padding: "6px 8px" }}
          /> : ""  
        }
          
          <div style={{ marginLeft: "auto", color: "#555" }}>
            {loading ? "جارٍ التحميل..." : `${closes.length} تقفيلة${closes.length !== 1 ? "" : ""}`}
          </div>
        </div>

        <div className={styles.cardsContainer}>
          {closes.length === 0 ? (
            <div className={styles.card} style={{ padding: 12 }}>لا توجد تقفيلات لهذا التاريخ</div>
          ) : (
            closes.map((c, idx) => {
              const timeLabel = c.closedAtTimestamp?.toDate ? c.closedAtTimestamp.toDate().toLocaleTimeString() : (c.closedAt ?? "-");
              const closedBy = c.closedBy ?? "-";
              const isSelected = idx === selectedCloseIndex;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCloseIndex(idx)}
                  className={`${styles.card} ${isSelected ? styles.selected : ""}`}
                  style={{
                    cursor: "pointer",
                    padding: 12,
                    border: isSelected ? "2px solid #ffd400" : "1px solid #e0e0e0",
                    borderRadius: 8,
                    minWidth: 160
                  }}
                >
                  <div>{timeLabel}</div>
                  <div>بواسطة: {closedBy}</div>
                </div>
              );
            })
          )}
        </div>

        {selectedClose && (
          <div className={styles.cardsContainer}>
            <div className={styles.card}>
              <h4>إجمالي المبيعات</h4>
              <p>{totals.totalSales}</p>
            </div>

            <div className={styles.card}>
              <h4>إجمالي المصروفات</h4>
              <p>{totals.totalExpenses}</p>
            </div>

            <div className={styles.card}>
              <h4>صافي المبيعات</h4>
              <p>{totals.net}</p>
            </div>

            <div className={styles.card}>
              <h4>قفل بواسطة</h4>
              <p>{selectedClose.closedBy ?? "-"}</p>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <button onClick={() => setShowSales(true)} style={{ padding: "8px 12px", background: showSales ? "#ffd400" : "#f1f1f1", border: "none", borderRadius: 6 }}>عرض المبيعات</button>
          <button onClick={() => setShowSales(false)} style={{ padding: "8px 12px", background: !showSales ? "#ffd400" : "#f1f1f1", border: "none", borderRadius: 6 }}>عرض المصروفات</button>
          <div style={{ marginLeft: "auto", color: "#444" }}>
            {selectedClose ? `عرض ${showSales ? "المبيعات" : "المصاريف"} للتقفيلة المختارة` : ""}
          </div>
        </div>

        <div className={styles.tableContainer} style={{ border: "1px solid #eee", borderRadius: 8 }}>
          <table>
            <thead>
              {showSales ? (
                <tr>
                  <th>فاتورة / ID</th>
                  <th>الموظف</th>
                  <th>الوقت</th>
                  <th>المنتجات</th>
                  <th>الإجمالي</th>
                  {currentUser === "mostafabeso10@gmail.com" && <th>الربح</th>}
                </tr>
              ) : (
                <tr>
                  <th>السبب</th>
                  <th>المحل</th>
                  <th>الوقت</th>
                  <th>المبلغ</th>
                </tr>
              )}
            </thead>

            <tbody>
              {!selectedClose ? (
                <tr>
                  <td colSpan={showSales ? (currentUser === "mostafabeso10@gmail.com" ? 6 : 5) : 4} style={{ padding: 12 }}>
                    اختر تقفيلة لعرض البيانات
                  </td>
                </tr>
              ) : (
                showSales
                  ? renderSalesRows(selectedClose.sales || [])
                  : renderExpenseRows(selectedClose.masrofat || [])
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
