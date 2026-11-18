"use client";
import { useState } from "react";
import { FaTrash, FaPlus } from "react-icons/fa";
import { MdOutlineEdit } from "react-icons/md";

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 2000,
  padding: "16px",
};
const box = {
  background: "var(--surface, #fff)",
  color: "var(--text-primary, #222)",
  borderRadius: "16px",
  padding: "24px",
  width: "460px",
  maxWidth: "100%",
  maxHeight: "90vh",
  overflowY: "auto",
  fontFamily: "Cairo, sans-serif",
  direction: "rtl",
};
const input = {
  flex: 1,
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid var(--border-color, #ccc)",
  background: "var(--surface, #fff)",
  color: "var(--text-primary, #222)",
  fontFamily: "inherit",
  fontSize: "15px",
  minWidth: 0,
};
const btn = (bg) => ({
  padding: "8px 12px",
  borderRadius: "8px",
  border: "none",
  background: bg,
  color: "#fff",
  cursor: "pointer",
  fontFamily: "inherit",
  display: "flex",
  alignItems: "center",
  gap: "6px",
});

/**
 * مودال إدارة الأقسام: إضافة قسم جديد / تعديل اسم قسم / حذف قسم
 */
export default function SectionsManager({
  isOpen,
  onClose,
  sections,
  addSection,
  renameSection,
  deleteSection,
  onSuccess,
  onError,
}) {
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const run = async (fn, msg) => {
    setBusy(true);
    try {
      await fn();
      onSuccess?.(msg);
      return true;
    } catch (err) {
      console.error(err);
      onError?.(err.message || "حدث خطأ");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async () => {
    const ok = await run(() => addSection(newName), "✅ تم إضافة القسم");
    if (ok) setNewName("");
  };

  const handleRename = async () => {
    const ok = await run(
      () => renameSection(editing, editValue),
      "✅ تم تعديل القسم وتحديث المنتجات التابعة له"
    );
    if (ok) setEditing(null);
  };

  const handleDelete = async (name) => {
    if (!window.confirm(`هل تريد حذف القسم "${name}"؟ (المنتجات الموجودة عليه لن تُحذف)`)) return;
    await run(() => deleteSection(name), "✅ تم حذف القسم");
  };

  return (
    <div style={overlay} onClick={() => !busy && onClose()}>
      <div style={box} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ textAlign: "center", marginBottom: "16px" }}>إدارة الأقسام</h3>

        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <input
            style={input}
            placeholder="اسم القسم الجديد (مثال: بنطلون)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !busy && handleAdd()}
            disabled={busy}
          />
          <button style={btn("var(--main-color, #2563eb)")} onClick={handleAdd} disabled={busy}>
            <FaPlus /> إضافة
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {sections.length === 0 && (
            <p style={{ textAlign: "center", opacity: 0.7 }}>لا توجد أقسام</p>
          )}
          {sections.map((s) => (
            <div
              key={s}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 10px",
                borderRadius: "8px",
                background: "var(--surface-hover, #f3f4f6)",
              }}
            >
              {editing === s ? (
                <>
                  <input
                    style={input}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !busy && handleRename()}
                    autoFocus
                    disabled={busy}
                  />
                  <button style={btn("var(--success, #16a34a)")} onClick={handleRename} disabled={busy}>
                    حفظ
                  </button>
                  <button style={btn("#6b7280")} onClick={() => setEditing(null)} disabled={busy}>
                    إلغاء
                  </button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontWeight: 600 }}>{s}</span>
                  <button
                    style={btn("var(--main-color, #2563eb)")}
                    title="تعديل"
                    onClick={() => {
                      setEditing(s);
                      setEditValue(s);
                    }}
                    disabled={busy}
                  >
                    <MdOutlineEdit />
                  </button>
                  <button
                    style={btn("#dc2626")}
                    title="حذف"
                    onClick={() => handleDelete(s)}
                    disabled={busy}
                  >
                    <FaTrash />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
          <button style={btn("#6b7280")} onClick={onClose} disabled={busy}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
