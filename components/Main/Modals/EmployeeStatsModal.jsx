"use client";
import { useEffect, useMemo, useState } from "react";
import styles from "../styles.module.css";

// حساب ربح الفاتورة (من profit المسجل أو من الـ cart)
const getInvoiceProfit = (invoice) => {
  if (typeof invoice.profit === "number") return invoice.profit;
  return (invoice.cart || []).reduce(
    (p, item) =>
      p + ((item.sellPrice || 0) - (item.buyPrice || 0)) * (item.quantity || 0),
    0
  );
};

const rowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 12px",
  background: "var(--surface)",
  borderRadius: "8px",
};
const labelStyle = { fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" };
const valueStyle = { fontSize: "17px", fontWeight: 700, color: "var(--main-color)" };

/**
 * إحصائيات الموظفين للفترة المفتوحة (من آخر تقفيل حتى الآن)
 * - تعتمد على كل فواتير dailySales (لا تتصفر الساعة 12، تتصفر فقط عند تقفيل اليوم)
 * - يمكن التبديل بين الموظفين لعرض مبيعات وقطع أي موظف
 */
export default function EmployeeStatsModal({
  isOpen,
  onClose,
  employeeName,
  invoices = [],
  employees = [],
}) {
  const [selected, setSelected] = useState(employeeName || "");

  useEffect(() => {
    if (isOpen) setSelected(employeeName || "");
  }, [isOpen, employeeName]);

  // إحصائيات كل الموظفين
  const statsByEmployee = useMemo(() => {
    const map = {};
    const ensure = (name) => {
      if (!map[name]) {
        map[name] = {
          name,
          invoiceCount: 0,
          totalItems: 0,
          totalSales: 0,
          totalProfit: 0,
          items: {},
        };
      }
      return map[name];
    };

    employees.forEach((emp) => {
      if (emp?.name) ensure(emp.name);
    });

    invoices.forEach((invoice) => {
      const name = invoice.employee;
      if (!name || name === "غير محدد") return;
      const s = ensure(name);
      s.invoiceCount += 1;
      s.totalSales += Number(invoice.total || 0);
      s.totalProfit += Number(getInvoiceProfit(invoice) || 0);
      (invoice.cart || []).forEach((item) => {
        const qty = Number(item.quantity || 0);
        s.totalItems += qty;
        const key = `${item.code || item.name}_${item.color || ""}_${item.size || ""}`;
        if (!s.items[key]) {
          s.items[key] = {
            name: item.name,
            code: item.code,
            color: item.color,
            size: item.size,
            quantity: 0,
            total: 0,
          };
        }
        s.items[key].quantity += qty;
        s.items[key].total += Number(item.sellPrice || 0) * qty;
      });
    });

    return map;
  }, [invoices, employees]);

  // ترتيب الموظفين حسب عدد القطع (الأنشط أولاً)
  const ranking = useMemo(
    () =>
      Object.values(statsByEmployee).sort(
        (a, b) => b.totalItems - a.totalItems || b.totalSales - a.totalSales
      ),
    [statsByEmployee]
  );

  if (!isOpen) return null;

  const current = statsByEmployee[selected] || ranking[0] || null;
  const currentName = current?.name || "";
  const topName = ranking[0]?.totalItems > 0 ? ranking[0].name : "";
  const items = current ? Object.values(current.items).sort((a, b) => b.quantity - a.quantity) : [];

  return (
    <div className={styles.popupOverlay} onClick={onClose}>
      <div
        className={styles.popupBox}
        onClick={(e) => e.stopPropagation()}
        style={{ width: "560px", maxWidth: "95%", maxHeight: "90vh", overflowY: "auto" }}
      >
        <h3>إحصائيات الموظفين</h3>

        {ranking.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--text-secondary)" }}>
            لا يوجد موظفين
          </p>
        ) : (
          <>
            {/* التبديل بين الموظفين */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
              {ranking.map((emp) => {
                const active = emp.name === currentName;
                return (
                  <button
                    key={emp.name}
                    onClick={() => setSelected(emp.name)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "20px",
                      border: "1px solid var(--main-color)",
                      background: active ? "var(--main-color)" : "transparent",
                      color: active ? "#fff" : "var(--text-primary)",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontWeight: 600,
                    }}
                  >
                    {emp.name === topName ? "⭐ " : ""}
                    {emp.name} ({emp.totalItems})
                  </button>
                );
              })}
            </div>

            {current && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  padding: "16px",
                  background: "var(--surface-hover)",
                  borderRadius: "12px",
                }}
              >
                <div style={{ textAlign: "center", fontWeight: 700, fontSize: "17px", color: "var(--text-primary)" }}>
                  {currentName}
                  {currentName === topName && " — أنشط موظف ⭐"}
                </div>
                <div style={rowStyle}>
                  <span style={labelStyle}>عدد الفواتير:</span>
                  <span style={valueStyle}>{current.invoiceCount}</span>
                </div>
                <div style={rowStyle}>
                  <span style={labelStyle}>عدد القطع:</span>
                  <span style={valueStyle}>{current.totalItems}</span>
                </div>
                <div style={rowStyle}>
                  <span style={labelStyle}>إجمالي المبيعات:</span>
                  <span style={{ ...valueStyle, color: "var(--success)" }}>
                    {current.totalSales.toFixed(2)} جنيه
                  </span>
                </div>
                <div style={rowStyle}>
                  <span style={labelStyle}>الربح من المبيعات:</span>
                  <span style={{ ...valueStyle, color: "var(--success)" }}>
                    {current.totalProfit.toFixed(2)} جنيه
                  </span>
                </div>

                <div style={{ fontWeight: 700, marginTop: "6px", color: "var(--text-primary)" }}>
                  القطع المباعة:
                </div>
                {items.length === 0 ? (
                  <div style={{ ...rowStyle, justifyContent: "center", color: "var(--text-secondary)" }}>
                    لا توجد قطع مباعة
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", color: "var(--text-primary)" }}>
                      <thead>
                        <tr style={{ background: "var(--surface)" }}>
                          <th style={{ padding: "6px" }}>المنتج</th>
                          <th style={{ padding: "6px" }}>اللون</th>
                          <th style={{ padding: "6px" }}>المقاس</th>
                          <th style={{ padding: "6px" }}>الكمية</th>
                          <th style={{ padding: "6px" }}>الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it, idx) => (
                          <tr key={idx} style={{ borderTop: "1px solid var(--border-color)", textAlign: "center" }}>
                            <td style={{ padding: "6px" }}>{it.name}{it.code ? ` (${it.code})` : ""}</td>
                            <td style={{ padding: "6px" }}>{it.color || "-"}</td>
                            <td style={{ padding: "6px" }}>{it.size || "-"}</td>
                            <td style={{ padding: "6px" }}>{it.quantity}</td>
                            <td style={{ padding: "6px" }}>{it.total.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div className={styles.popupBtns} style={{ marginTop: "20px" }}>
          <button onClick={onClose} className={styles.cancelBtn}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
