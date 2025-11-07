'use client';
import SideBar from "@/components/SideBar/page";
import styles from "./styles.module.css";
import { useState, useEffect } from "react";
import { MdDriveFileRenameOutline } from "react-icons/md";
import { GiMoneyStack } from "react-icons/gi";
import { CiSearch } from "react-icons/ci";
import { FaRegTrashAlt } from "react-icons/fa";
import { MdOutlineEdit } from "react-icons/md";
import { FaRuler } from "react-icons/fa";
import { FaPlus, FaMinus, FaTrash } from "react-icons/fa6";
import { useRouter } from "next/navigation";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  onSnapshot,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";

function Products() {
  const [auth, setAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(false);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchCode, setSearchCode] = useState("");
  const [totalBuy, setTotalBuy] = useState(0);
  const [totalSell, setTotalSell] = useState(0);
  const [form, setForm] = useState({
    name: "",
    buyPrice: "",
    sellPrice: "",
    color: "",
    sizeType: "",
    quantity: "",
    category: "",
  });

  // NOTE: colors is now the full structure: [{ color: 'Black', sizes: [{size:'M', qty:5}, ...] }, ...]
  const [colors, setColors] = useState([]);
  const [editId, setEditId] = useState(null);

  // Modal state - temp structures while editing inside modal
  const [showModal, setShowModal] = useState(false);
  const [modalCategory, setModalCategory] = useState("");
  const [modalSizeType, setModalSizeType] = useState("");
  const [tempColors, setTempColors] = useState([]); // [{color, sizes: [{size, qty}]}]

  // مجموعات المقاسات (مساعدة للـ "إضافة جاهزة")
  const sizeGroups = {
    "شبابي": ["36", "37", "38", "39", "40", "41"],
    "رجالي": ["40", "41", "42", "43", "44", "45"],
    "هدوم": ["S", "M", "L", "XL", "2XL"],
  };

  const baseColors = []; // لم نعد نستخدم كقيمة quantity واحدة — الآن كل لون له sizes

  const router = useRouter();
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
        if (user.permissions?.products === true) {
          alert("ليس ليدك الصلاحية للوصول الى هذه الصفحة❌");
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

  // ===========================
  // useEffect: جلب المنتجات من lacosteProducts
  // ===========================
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

      // حساب الاجماليات: نحسب مجموع الكميات مضروبة في السعر لكل مقاس (لوصيغة المنتجات الجديدة)
      let totalBuyAmount = 0;
      let totalSellAmount = 0;
      data.forEach((product) => {
        let productQty = 0;
        if (product.colors && product.colors.length) {
          // sum over colors -> sizes -> qty
          product.colors.forEach((c) => {
            if (c.sizes && c.sizes.length) {
              c.sizes.forEach((sz) => {
                productQty += Number(sz.qty || 0);
              });
            } else if (c.quantity) {
              // قديمة - compatibility
              productQty += Number(c.quantity || 0);
            }
          });
        } else {
          productQty = Number(product.quantity || 0);
        }
        totalBuyAmount += (product.buyPrice || 0) * productQty;
        totalSellAmount += (product.sellPrice || 0) * productQty;
      });
      setTotalBuy(totalBuyAmount);
      setTotalSell(totalSellAmount);

      if (searchCode.trim()) {
        const filtered = data.filter((p) =>
          p.name?.toString().toLowerCase().includes(searchCode.trim().toLowerCase())
        );
        setFilteredProducts(filtered);
      } else {
        setFilteredProducts(data);
      }
    });

    return () => unsubscribe();
  }, [searchCode]);

  const getNextCode = async () => {
    const shop = localStorage.getItem("shop");
    const q = query(collection(db, "lacosteProducts"), where("shop", "==", shop));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return 1000;

    const codes = snapshot.docs
      .map((doc) => Number(doc.data().code))
      .filter((code) => !isNaN(code));

    const maxCode = Math.max(...codes);
    return maxCode + 1;
  };

  // helper: compute total qty from colors structure
  const computeTotalQtyFromColors = (colorsArr) => {
    let total = 0;
    if (!Array.isArray(colorsArr)) return 0;
    colorsArr.forEach((c) => {
      if (Array.isArray(c.sizes)) {
        c.sizes.forEach((s) => {
          total += Number(s.qty || 0);
        });
      } else if (c.quantity) {
        // backwards compatibility
        total += Number(c.quantity || 0);
      }
    });
    return total;
  };

  const handleAddProduct = async () => {
    const shop = localStorage.getItem("shop");
    const newCode = await getNextCode();

    const totalQty =
      colors && colors.length
        ? computeTotalQtyFromColors(colors)
        : Number(form.quantity) || 0;

    // construct product object
    const productObj = {
      code: newCode,
      name: form.name || "",
      buyPrice: Number(form.buyPrice) || 0,
      sellPrice: Number(form.sellPrice) || 0,
      quantity: totalQty,
      // now we save colors structure
      colors: colors || [],
      sizes: [], // legacy field left empty for compatibility
      sizeType: form.sizeType || "",
      category: form.category || "",
      date: Timestamp.now(),
      shop: shop,
      type: "product",
    };

    await addDoc(collection(db, "lacosteProducts"), productObj);

    alert("✅ تم إضافة المنتج بنجاح");
    setForm({
      name: "",
      buyPrice: "",
      sellPrice: "",
      color: "",
      sizeType: "",
      quantity: "",
      category: "",
    });
    setColors([]);
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "lacosteProducts", id));
    } catch (err) {
      console.error("❌ خطأ أثناء الحذف:", err);
    }
  };

  const handleEdit = (product) => {
    setEditId(product.id);
    setForm({
      name: product.name,
      buyPrice: product.buyPrice,
      sellPrice: product.sellPrice,
      color: product.color || "",
      sizeType: product.sizeType || "",
      quantity: product.quantity || "",
      category: product.category || "",
    });

    // Normalize colors: support both old format (color + quantity) and new format
    if (product.colors && product.colors.length) {
      const normalized = product.colors.map((c) => {
        // if each color already has sizes array, keep it (and map qty -> qty)
        if (Array.isArray(c.sizes)) {
          // ensure each size uses 'qty' key
          const sizes = c.sizes.map((s) => ({
            size: s.size || s.sizeName || s.name || String(s.size),
            qty: Number(s.qty ?? s.quantity ?? s[ "quantity" ] ?? s.count ?? 0),
          }));
          return { color: c.color, sizes };
        } else if (c.quantity !== undefined) {
          // old format like { color: 'أبيض', quantity: 3 }
          // convert to sizes array with a single generic size 'الكمية' to preserve number
          return { color: c.color, sizes: [{ size: "الكمية", qty: Number(c.quantity || 0) }] };
        } else {
          // unknown shape — keep as empty sizes
          return { color: c.color || c.name || "غير معروف", sizes: [] };
        }
      });
      setColors(normalized);
      setTempColors(normalized.map(c => ({ color: c.color, sizes: c.sizes.map(s => ({...s})) })));
    } else {
      // no colors present
      setColors([]);
      setTempColors([]);
    }

    setActive("edit");
  };

  const handleUpdateProduct = async () => {
    if (!editId) return;
    try {
      const totalQty = colors && colors.length ? computeTotalQtyFromColors(colors) : Number(form.quantity) || 0;

      const productRef = doc(db, "lacosteProducts", editId);
      await updateDoc(productRef, {
        name: form.name || "",
        buyPrice: Number(form.buyPrice) || 0,
        sellPrice: Number(form.sellPrice) || 0,
        quantity: totalQty,
        colors: colors || [],
        sizes: [], // legacy
        sizeType: form.sizeType || "",
        category: form.category || "",
      });
      alert("✅ تم تحديث المنتج");
      setEditId(null);
      setForm({
        name: "",
        buyPrice: "",
        sellPrice: "",
        color: "",
        sizeType: "",
        quantity: "",
        category: "",
      });
      setColors([]);
      setActive(false);
    } catch (err) {
      console.error("❌ خطأ أثناء التحديث:", err);
    }
  };

  // === Modal handlers (color -> sizes) ===

  const openModalForCategory = (category) => {
    setModalCategory(category);
    setModalSizeType(form.sizeType || "");
    // prepare tempColors from current values or defaults
    setTempColors(colors.length ? colors.map(c => ({ color: c.color, sizes: c.sizes.map(s => ({ ...s })) })) : []);
    setShowModal(true);
  };

  const handleCategorySelect = (category) => {
    setForm(prev => ({ ...prev, category }));
    openModalForCategory(category);
  };

  // Color functions in modal
  const addTempColor = () => {
    const newColor = prompt("اكتب اللون الجديد:");
    if (!newColor) return;
    setTempColors(prev => {
      const exists = prev.find(p => p.color.toLowerCase() === newColor.toLowerCase());
      if (exists) {
        return prev;
      }
      return [...prev, { color: newColor, sizes: [] }];
    });
  };

  const removeTempColor = (colorName) => {
    setTempColors(prev => prev.filter(c => c.color !== colorName));
  };

  // Sizes per color functions
  const addTempSizeToColor = (colorIndex) => {
    const sizeName = prompt("اكتب اسم المقاس (مثال: M أو 42):");
    if (!sizeName) return;
    const qtyStr = prompt("اكتب الكمية لهذا المقاس (رقم):", "1");
    const qty = Math.max(0, Number(qtyStr || 0));
    setTempColors(prev => {
      const copy = prev.map(c => ({ color: c.color, sizes: c.sizes.map(s => ({ ...s })) }));
      const target = copy[colorIndex];
      const existing = target.sizes.find(s => s.size === sizeName);
      if (existing) {
        existing.qty = Number(existing.qty || 0) + qty;
      } else {
        target.sizes.push({ size: sizeName, qty });
      }
      return copy;
    });
  };

  const incTempSizeQty = (colorIndex, sizeName) => {
    setTempColors(prev => prev.map((c, ci) => {
      if (ci !== colorIndex) return c;
      return { ...c, sizes: c.sizes.map(s => s.size === sizeName ? { ...s, qty: Number(s.qty || 0) + 1 } : s) };
    }));
  };
  const decTempSizeQty = (colorIndex, sizeName) => {
    setTempColors(prev => prev.map((c, ci) => {
      if (ci !== colorIndex) return c;
      return { ...c, sizes: c.sizes.map(s => s.size === sizeName ? { ...s, qty: Math.max(0, Number(s.qty || 0) - 1) } : s) };
    }));
  };

  const removeTempSizeFromColor = (colorIndex, sizeName) => {
    setTempColors(prev => prev.map((c, ci) => {
      if (ci !== colorIndex) return c;
      return { ...c, sizes: c.sizes.filter(s => s.size !== sizeName) };
    }));
  };

  const addPresetSizesToColor = (colorIndex) => {
    // add default sizes according to modalSizeType / category
    const group = modalCategory === "احذية" && modalSizeType ? sizeGroups[modalSizeType] : modalCategory === "هدوم" ? sizeGroups["هدوم"] : [];
    if (!group.length) {
      alert("لا توجد مجموعة جاهزة للصنف/نوع المقاس الحالي.");
      return;
    }
    setTempColors(prev => {
      const copy = prev.map(c => ({ color: c.color, sizes: c.sizes.map(s => ({ ...s })) }));
      const target = copy[colorIndex];
      group.forEach(sz => {
        if (!target.sizes.find(s => s.size === sz)) {
          target.sizes.push({ size: sz, qty: 1 });
        }
      });
      return copy;
    });
  };

  const saveModal = () => {
    // filter out sizes with qty 0
    const cleaned = tempColors.map(c => ({
      color: c.color,
      sizes: (c.sizes || []).filter(s => Number(s.qty || 0) > 0).map(s => ({ size: s.size, qty: Number(s.qty || 0) }))
    })).filter(c => c.color && c.sizes && c.sizes.length > 0);
    setColors(cleaned);
    setForm(prev => ({ ...prev, sizeType: modalSizeType }));
    setShowModal(false);
  };

  const cancelModal = () => {
    setTempColors([]);
    setShowModal(false);
  };

  const handlePrintLabel = (product) => {
    const printWindow = window.open('', '', 'width=400,height=300');
    const htmlContent = `
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            @media print {
              @page {
                size: auto;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            .label {
              width: 100%;
              height: 100%;
              box-sizing: border-box;
              padding: 2mm;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              font-family: Arial, sans-serif;
              font-size: 8pt;
              gap: 1mm;
              page-break-inside: avoid;
              overflow: hidden;
              text-align: center;
            }
            .name {
              max-width: 100%;
              font-weight: 600;
              line-height: 1.1;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .content {
              display: flex;
              gap: 2mm;
              flex-wrap: wrap;
              justify-content: center;
              align-items: center;
              font-size: 7pt;
            }
            /* حجم الباركود أكبر شوي */
            svg.barcode {
              width: 40mm;
              height: 12mm;/* ✅ زودنا الارتفاع */
            }
            .barcode rect, .barcode path { shape-rendering: crispEdges; }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="name">${product.name ?? ''}</div>
            <div class="content">
              <div><strong>سعر البيع:</strong> ${product.sellPrice ?? ''} EGP</div>
              <div><strong>الكود:</strong> ${product.code ?? ''}</div>
            </div>
            <svg id="barcode" class="barcode"></svg>
          </div>

          <script>
            window.onload = function () {
              JsBarcode("#barcode", "${'${product.code}'}", {
                format: "CODE128",
                displayValue: false,
                margin: 0
              });
              setTimeout(() => {
                window.print();
                window.onafterprint = () => window.close();
              }, 100);
            };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className={styles.products}>
      <SideBar />
      <div className={styles.content}>
        <div className={styles.btns}>
          <button onClick={() => { setActive(false); setEditId(null); }}>كل المنتجات</button>
          <button onClick={() => { setActive(true); setEditId(null); }}>اضف منتج جديد</button>
        </div>

        {loading ? <p>🔄 جاري التحقق...</p> : !auth ? null : (
          <>
            {!active && (
              <div className={styles.phoneContainer}>
                <div className={styles.searchBox}>
                  <div className="inputContainer">
                    <label><CiSearch /></label>
                    <input
                      type="text"
                      list="codesList"
                      placeholder="ابحث بالاسم"
                      value={searchCode}
                      onChange={(e) => setSearchCode(e.target.value)}
                    />
                    <datalist id="codesList">
                      {products.map((p) => (
                        <option key={p.id} value={p.name} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className={styles.totals}>
                  <p>اجمالي الشراء: {totalBuy} EGP</p>
                  <p>اجمالي البيع: {totalSell} EGP</p>
                </div>

                <div className={styles.tableContainer}>
                  <table>
                    <thead>
                      <tr>
                        <th>الكود</th>
                        <th>الاسم</th>
                        <th>سعر الشراء</th>
                        <th>سعر البيع</th>
                        <th>الكمية</th>
                        <th>الألوان (الكمية)</th>
                        <th>تفصيل المقاسات</th>
                        <th>التاريخ</th>
                        <th>خيارات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product) => {
                        // compute qty and strings for display
                        const colorsList = product.colors || [];
                        let totalQ = 0;
                        const colorsQtyStr = colorsList.map(c => {
                          const colorTotal = (c.sizes && c.sizes.length) ? c.sizes.reduce((s, it) => s + Number(it.qty || 0), 0) : (c.quantity || 0);
                          totalQ += colorTotal;
                          return `${c.color} (${colorTotal})`;
                        }).join(" — ");
                        const sizesDetail = colorsList.map(c => {
                          const detail = (c.sizes && c.sizes.length) ? c.sizes.map(s => `${s.size}(${s.qty})`).join(", ") : (c.quantity ? `كمية: ${c.quantity}` : "-");
                          return `${c.color}: ${detail}`;
                        }).join(" | ");
                        return (
                          <tr key={product.id}>
                            <td>{product.code}</td>
                            <td>{product.name || "-"}</td>
                            <td>{product.buyPrice || 0} EGP</td>
                            <td>{product.sellPrice || 0} EGP</td>
                            <td>{totalQ || product.quantity || 0}</td>
                            <td>{colorsQtyStr || "-"}</td>
                            <td style={{ whiteSpace: 'pre-wrap', maxWidth: 300 }}>{sizesDetail || "-"}</td>
                            <td>{product.date?.toDate ? product.date.toDate().toLocaleDateString("ar-EG") : product.date}</td>
                            <td className={styles.actions}>
                              <button onClick={() => handleDelete(product.id)}><FaRegTrashAlt /></button>
                              <button onClick={() => handleEdit(product)}><MdOutlineEdit /></button>
                              <button onClick={() => handlePrintLabel(product)}>🖨️</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {(active === true || active === "edit") && (
              <div className={styles.addContainer}>
                <div className={styles.inputBox}>
                  <div className="inputContainer">
                    <label><MdDriveFileRenameOutline /></label>
                    <input
                      type="text"
                      placeholder="اسم المنتج"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.inputBox}>
                  <div className="inputContainer">
                    <label><GiMoneyStack /></label>
                    <input
                      type="number"
                      placeholder="سعر الشراء"
                      value={form.buyPrice}
                      onChange={(e) => setForm({ ...form, buyPrice: e.target.value })}
                    />
                  </div>
                  <div className="inputContainer">
                    <label><GiMoneyStack /></label>
                    <input
                      type="number"
                      placeholder="سعر البيع"
                      value={form.sellPrice}
                      onChange={(e) => setForm({ ...form, sellPrice: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.inputBox}>
                  <div className="inputContainer">
                    <label>الصنف</label>
                    <select
                      value={form.category}
                      onChange={(e) => handleCategorySelect(e.target.value)}
                    >
                      <option value="">اختر الصنف</option>
                      <option value="احذية">احذية</option>
                      <option value="هدوم">هدوم</option>
                      <option value="اكسسوار">اكسسوار</option>
                    </select>
                  </div>
                </div>

                {/* show selected sizeType or a hint to open modal */}
                {form.category === "احذية" && (
                  <div className={styles.inputBox}>
                    <div className="inputContainer">
                      <label><FaRuler /></label>
                      <select
                        value={form.sizeType}
                        onChange={(e) => setForm({ ...form, sizeType: e.target.value })}
                      >
                        <option value="">اختر نوع المقاس</option>
                        <option value="شبابي">شبابي</option>
                        <option value="رجالي">رجالي</option>
                      </select>
                      <small className={styles.hint}>لم يتم اختيار الوان بعد</small>
                    </div>
                  </div>
                )}

                {/* Button to open modal to manage colors & sizes */}
                <div className={styles.inputBox}>
                  <button className={styles.manageBtn} onClick={() => openModalForCategory(form.category || 'اكسسوار')}>تحرير الألوان والمقاسات</button>
                </div>

                {/* show current colors + sizes summary in the form */}
                <div className={styles.colorsBox}>
                  <h4>تفاصيل الألوان والمقاسات</h4>
                  {colors.length === 0 && <p className={styles.emptyState}>لم يتم اضافة الوان بعد</p>}
                  {colors.map((c, idx) => (
                    <div key={idx} className={styles.sizeRow}>
                      <strong>{c.color}</strong>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                        {c.sizes && c.sizes.length ? c.sizes.map((s, si) => (
                          <div key={si} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #e0e0e0', background: '#fff', display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span>{s.size}</span>
                            <span style={{ fontWeight: 600 }}>{s.qty}</span>
                          </div>
                        )) : <em style={{ color:'#666' }}>لا توجد مقاسات</em>}
                      </div>
                    </div>
                  ))}
                </div>

                {form.category === "اكسسوار" && (
                  <div className={styles.inputBox}>
                    <div className="inputContainer">
                      <label><FaPlus /></label>
                      <input
                        type="number"
                        placeholder="الكمية"
                        value={form.quantity}
                        onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {active === "edit" ? (
                  <button className={styles.addBtn} onClick={handleUpdateProduct}>تحديث المنتج</button>
                ) : (
                  <button className={styles.addBtn} onClick={handleAddProduct}>اضف المنتج</button>
                )}
              </div>
            )}

            {/* Modal for colors & sizes */}
            {showModal && (
              <div className={styles.modalOverlay} onClick={cancelModal}>
                <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.modalContent}>
                    <div className={styles.modalHeader}>
                    <h3>اعدادات الألوان والمقاسات — {modalCategory || 'الصنف'}</h3>
                    <button onClick={cancelModal} className={styles.closeBtn}>✖</button>
                  </div>

                  <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                    <button onClick={addTempColor} className={styles.smallBtn}>➕ أضف لون</button>
                    <button onClick={() => {
                      // quick fill colors example (optional)
                      const sample = ["أبيض", "أسود", "أحمر", "أزرق"];
                      setTempColors(prev => {
                        const copy = prev.map(c => ({ color: c.color, sizes: c.sizes.map(s => ({...s})) }));
                        sample.forEach(col => {
                          if (!copy.find(c => c.color === col)) copy.push({ color: col, sizes: [] });
                        });
                        return copy;
                      });
                    }} className={styles.smallBtn}>أضف ألوان تجريبية</button>
                    {modalCategory === 'احذية' && (
                      <select value={modalSizeType} onChange={(e) => setModalSizeType(e.target.value)} style={{ padding: '6px 8px', borderRadius: 8 }}>
                        <option value="">نوع المقاس (اختياري)</option>
                        <option value="شبابي">شبابي</option>
                        <option value="رجالي">رجالي</option>
                      </select>
                    )}
                  </div>

                  <div className={styles.modalSection}>
                    <div className={styles.sectionHeader}>
                      <h4>الألوان المضافة</h4>
                      <div />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginTop: 10 }}>
                      {tempColors.map((c, ci) => (
                        <div key={ci} className={styles.gridItem}>
                          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontWeight: 700 }}>{c.color}</div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => addPresetSizesToColor(ci)} className={styles.smallBtn}>إضافة جاهزة</button>
                              <button onClick={() => removeTempColor(c.color)} className={`${styles.smallBtn} ${styles.delete}`}>حذف</button>
                            </div>
                          </div>

                          <div style={{ marginTop: 8, width: '100%' }}>
                            <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                              <button onClick={() => addTempSizeToColor(ci)} className={styles.smallBtn}>➕ أضف مقاس لهذا اللون</button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {c.sizes && c.sizes.length ? c.sizes.map((s, si) => (
                                <div key={si} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, border: '1px solid #eee', background:'#fff' }}>
                                  <div style={{ fontWeight:600 }}>{s.size}</div>
                                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                                    <button onClick={() => decTempSizeQty(ci, s.size)} className={styles.smallBtn}><FaMinus /></button>
                                    <span style={{ minWidth:24, textAlign:'center', fontWeight:600 }}>{s.qty}</span>
                                    <button onClick={() => incTempSizeQty(ci, s.size)} className={styles.smallBtn}><FaPlus /></button>
                                    <button onClick={() => removeTempSizeFromColor(ci, s.size)} className={`${styles.smallBtn} ${styles.delete}`}><FaTrash /></button>
                                  </div>
                                </div>
                              )) : <div style={{ color:'#777' }}>لا توجد مقاسات لهذا اللون</div>}
                            </div>
                          </div>
                        </div>
                      ))}
                      {tempColors.length === 0 && <div className={styles.emptyState}>لم تضف ألوان بعد</div>}
                    </div>
                  </div>

                  <div style={{ marginTop: 12, display:'flex', justifyContent:'flex-end', gap: 8 }}>
                    <button onClick={cancelModal} className={styles.btnOutline}>إلغاء</button>
                    <button onClick={saveModal} className={styles.btnPrimary}>حفظ</button>
                  </div>
                  </div>
                </div>
              </div>
            )}

          </>
        )}

      </div>
    </div>
  );
}

export default Products;
