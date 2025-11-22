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
  getDoc,
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
  const [finalPrice, setFinalPrice] = useState("");
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchCode, setSearchCode] = useState("");
  const [totalBuy, setTotalBuy] = useState(0);
  const [totalSell, setTotalSell] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0)
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteForm, setDeleteForm] = useState([]);  

  const [form, setForm] = useState({
    name: "",
    buyPrice: "",
    sellPrice: "",
    color: "",
    sizeType: "",
    quantity: "",
    category: "",
  });

  const [colors, setColors] = useState([]);
  const [editId, setEditId] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [modalCategory, setModalCategory] = useState("");
  const [modalSizeType, setModalSizeType] = useState("");
  const [tempColors, setTempColors] = useState([]);

  const sizeGroups = {
    "شبابي": ["36", "37", "38", "39", "40", "41"],
    "رجالي": ["40", "41", "42", "43", "44", "45"],
    "هدوم": ["S", "M", "L", "XL", "2XL"],
  };

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
      let totalQty = 0;

data.forEach((product) => {
  let productQty = 0;

  if (product.colors && product.colors.length) {
    product.colors.forEach((c) => {
      if (c.sizes && c.sizes.length) {
        c.sizes.forEach((sz) => {
          productQty += Number(sz.qty || 0);
        });
      } else if (c.quantity) {
        productQty += Number(c.quantity || 0);
      }
    });
  } else {
    productQty = Number(product.quantity || 0);
  }

  totalQty += productQty;
});

setTotalProducts(totalQty);


      let totalBuyAmount = 0;
      let totalSellAmount = 0;
      data.forEach((product) => {
        let productQty = 0;
        if (product.colors && product.colors.length) {
          product.colors.forEach((c) => {
            if (c.sizes && c.sizes.length) {
              c.sizes.forEach((sz) => {
                productQty += Number(sz.qty || 0);
              });
            } else if (c.quantity) {
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

      let filtered;

if (searchCode.trim()) {
  filtered = data.filter((p) =>
    p.code?.toString().toLowerCase().includes(searchCode.trim().toLowerCase())
  );
} else {
  filtered = data;
}

setFilteredProducts(filtered);

// تحديث إجمالي الكمية حسب نتائج البحث
setTotalProducts(computeTotalProducts(filtered));

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

  const computeTotalProducts = (productsArr) => {
  let total = 0;

  productsArr.forEach((product) => {
    let qty = 0;

    if (product.colors && product.colors.length) {
      qty = computeTotalQtyFromColors(product.colors); // ← دي الدالة اللي عندك
    } else {
      qty = Number(product.quantity || 0);
    }

    total += qty;
  });

  return total;
};


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

  const handleAddProduct = async () => {
    const shop = localStorage.getItem("shop");
    const newCode = await getNextCode();
    const totalQty =
      colors && colors.length
        ? computeTotalQtyFromColors(colors)
        : Number(form.quantity) || 0;

    const productObj = {
      code: newCode,
      name: form.name || "",
      buyPrice: Number(form.buyPrice) || 0,
      sellPrice: Number(form.sellPrice) || 0,
      finalPrice: Number(finalPrice) || 0,
      quantity: totalQty,
      colors: colors || [],
      sizes: [],
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

const handleDelete = async (product) => {

  const hasColors = product.colors && product.colors.length > 0;

  // ✅ لو المنتج ملوش ألوان → نحذفه فورًا + نخزّنه في deletedProducts
  if (!hasColors) {
    try {
      // الكمية اللي تتحسب في التقارير
      const deletedQty = Number(product.quantity || 1);

      // 1. تخزين المنتج في deletedProducts
      await addDoc(collection(db, "deletedProducts"), {
        name: product.name,
        buyPrice: Number(product.buyPrice) || 0,
        sellPrice: Number(product.sellPrice) || 0,
        deletedTotalQty: deletedQty,     // 👈 أهم سطر
        shop: product.shop || shop,      // لو بتستخدم shop
        code: product.code || "",
        type: product.type || "",
        deletedAt: new Date(),
      });

      // 2. حذف المنتج من lacosteProducts
      await deleteDoc(doc(db, "lacosteProducts", product.id));

      alert("تم حذف المنتج وحفظه في السجل بنجاح");

    } catch (e) {
      console.error("Error deleting product:", e);
      alert("حدث خطأ أثناء الحذف");
    }

    return; // مهم جدًا
  }

  // 🔽 الكود القديم لفتح الـ popup لو المنتج ليه ألوان/مقاسات
  setDeleteTarget(product);

  const formatted = (product.colors || []).map((c) => ({
    color: c.color,
    sizes: (c.sizes || []).map((s) => ({
      size: s.size,
      qty: s.qty,
      deleteQty: 0,
    }))
  }));

  setDeleteForm(formatted);
  setShowDeletePopup(true);
};


const computeTempColorsQty = () => {
  if (!tempColors || tempColors.length === 0) return Number(form.quantity) || 0;
  return tempColors.reduce((total, c) => {
    const colorQty = c.sizes && c.sizes.length
      ? c.sizes.reduce((sum, s) => sum + Number(s.qty || 0), 0)
      : 0;
    return total + colorQty;
  }, 0);
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
    setFinalPrice(product.finalPrice)

    if (product.colors && product.colors.length) {
      const normalized = product.colors.map((c) => {
        if (Array.isArray(c.sizes)) {
          const sizes = c.sizes.map((s) => ({
            size: s.size || s.sizeName || s.name || String(s.size),
            qty: Number(s.qty ?? s.quantity ?? s.count ?? 0),
          }));
          return { color: c.color, sizes };
        } else if (c.quantity !== undefined) {
          return { color: c.color, sizes: [{ size: "الكمية", qty: Number(c.quantity || 0) }] };
        } else {
          return { color: c.color || "غير معروف", sizes: [] };
        }
      });
      setColors(normalized);
      setTempColors(normalized.map(c => ({ color: c.color, sizes: c.sizes.map(s => ({...s})) })));
    } else {
      setColors([]);
      setTempColors([]);
    }

    setActive("edit");
  };

  const handleUpdateProduct = async () => {
    if (!editId) return;
    try {
      const totalQty = colors && colors.length
        ? computeTotalQtyFromColors(colors)
        : Number(form.quantity) || 0;

      const productRef = doc(db, "lacosteProducts", editId);
      await updateDoc(productRef, {
        name: form.name || "",
        buyPrice: Number(form.buyPrice) || 0,
        sellPrice: Number(form.sellPrice) || 0,
        finalPrice: Number(finalPrice) || 0,
        quantity: totalQty,
        colors: colors || [],
        sizes: [],
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

  const openModalForCategory = (category) => {
    setModalCategory(category);
    setModalSizeType(form.sizeType || "");
    setTempColors(colors.length
      ? colors.map(c => ({ color: c.color, sizes: c.sizes.map(s => ({ ...s })) }))
      : []);
    setShowModal(true);
  };

  const handleCategorySelect = (category) => {
    setForm(prev => ({ ...prev, category }));
    openModalForCategory(category);
  };

  const addTempColor = () => {
    const newColor = prompt("اكتب اللون الجديد:");
    if (!newColor) return;
    setTempColors(prev => {
      const exists = prev.find(p => p.color.toLowerCase() === newColor.toLowerCase());
      if (exists) return prev;
      return [...prev, { color: newColor, sizes: [] }];
    });
  };

  const removeTempColor = (colorName) => {
    setTempColors(prev => prev.filter(c => c.color !== colorName));
  };

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
    const group = modalCategory === "احذية" && modalSizeType
      ? sizeGroups[modalSizeType]
      : modalCategory === "هدوم"
        ? sizeGroups["هدوم"]
        : [];
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
    const cleaned = tempColors.map(c => ({
      color: c.color,
      sizes: (c.sizes || [])
        .filter(s => Number(s.qty || 0) > 0)
        .map(s => ({ size: s.size, qty: Number(s.qty || 0) })),
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
    const printWindow = window.open("", "", "width=400,height=300");
    const htmlContent = `
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            @media print {
              @page { size: 40mm 30mm; margin: 0; }
              body { margin:0; padding:0; }
            }
            body {
              width: 40mm;
              height: 30mm;
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .label {
              width: 100%;
              height: 100%;
              padding: 0.5mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              overflow: hidden;
              text-align: center;
              gap: 0.5mm;
            }
              .container {
                width: 100%;
                display: flex;
                justify-content: space-between;
                align-items: center;
              }
            .name {
              font-size: 10pt;
              font-weight: bold;
              line-height: 1;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 100%;
            }
            .price {
              font-size: 10pt;
              line-height: 1;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            svg.barcode {
              width: 36mm;
              height: 15mm;
            }

          </style>
        </head>
        <body>
          <div class="label">
          <div class="container">
          <div class="price">${product.sellPrice ?? ''} EGP</div>
          <div class="name">${product.name ?? ''}</div>
          </div>
            
            <svg id="barcode" class="barcode"></svg>
            <div class="price">${product.code ?? ''} </div>
          </div>
          <script>
            window.onload = function () {
              JsBarcode("#barcode", "${product.code}", {
                format: "CODE128",
                displayValue: false,
                margin: 0,
                width: 1.5,
                height: 15
              });
              setTimeout(() => {
                window.print();
                window.onafterprint = () => window.close();
              }, 200);
            };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };
const confirmDeleteSelected = async () => {
  if (!deleteTarget || !deleteForm.length) return;

  const shop = localStorage.getItem("shop");

  // تجهيز قائمة العناصر اللي هتتحذف فعليًا
  const deletedList = [];
  let deletedTotalQty = 0;
  let deletedTotalValue = 0; // بناءً على سعر الشراء في المنتج كافتراض

  // validate using for-loops so we can exit early
  for (let ci = 0; ci < deleteForm.length; ci++) {
    const color = deleteForm[ci];
    for (let si = 0; si < color.sizes.length; si++) {
      const size = color.sizes[si];
      const dq = Number(size.deleteQty || 0);
      const available = Number(size.qty || 0);

      if (dq > 0) {
        if (dq > available) {
          alert(`لا يمكنك حذف أكثر من الكمية الموجودة للمقاس ${size.size} (اللون ${color.color})`);
          return; // خروج فوري لو فيه خطأ
        }

        // تجمع بيانات المحذوف
        deletedList.push({
          color: color.color,
          size: size.size,
          qty: dq,
        });

        deletedTotalQty += dq;

        // حساب قيمة المحذوف — نفترض سعر الشراء للمنتج كله
        const buyPrice = Number(deleteTarget.buyPrice || 0);
        deletedTotalValue += buyPrice * dq;
      }
    }
  }

  if (deletedList.length === 0) {
    alert("لم تحدد أي كميات للحذف");
    return;
  }

  try {
    // 1) إضافة المحذوف إلى deletedProducts مع تفصيل الكميات وقيمتها
    await addDoc(collection(db, "deletedProducts"), {
      ...deleteTarget,
      deletedParts: deletedList,
      deletedTotalQty,
      deletedTotalValue,
      deletedAt: Timestamp.now(),
      originalId: deleteTarget.id,
      shop
    });

    // 2) تعديل المنتج الأصلي
    let updatedColors = deleteTarget.colors.map(c => ({
      color: c.color,
      sizes: c.sizes.map(s => ({ ...s }))
    }));

    // طرح الكميات المحذوفة
    deletedList.forEach(del => {
      const col = updatedColors.find(c => c.color === del.color);
      if (!col) return;
      const size = col.sizes.find(s => String(s.size) === String(del.size));
      if (!size) return;
      size.qty = Number(size.qty || 0) - Number(del.qty || 0);
    });

    // حذف المقاسات اللي بقت صفر
    updatedColors = updatedColors.map(c => ({
      color: c.color,
      sizes: c.sizes.filter(s => Number(s.qty || 0) > 0)
    })).filter(c => c.sizes.length > 0);

    const productRef = doc(db, "lacosteProducts", deleteTarget.id);

    if (updatedColors.length === 0) {
      // حذف المنتج بالكامل
      await deleteDoc(productRef);
    } else {
      // إعادة حساب الكمية الإجمالية
      const newQuantity = updatedColors.reduce(
        (t, c) => t + c.sizes.reduce((s, x) => s + Number(x.qty || 0), 0),
        0
      );

      // تحديث المنتج
      await updateDoc(productRef, {
        colors: updatedColors,
        quantity: newQuantity
      });
    }

    // تنظيف الواجهة
    setShowDeletePopup(false);
    setDeleteTarget(null);
    setDeleteForm([]);

    // اختياري: إظهار ملخص للمستخدم
    alert(`✅ تم حذف ${deletedTotalQty} قطعة (قيمة تقريبية: ${deletedTotalValue} كقيمة شراء).`);

  } catch (err) {
    console.error("خطأ أثناء عملية الحذف الجزئي:", err);
    alert("حدث خطأ أثناء حذف العناصر، حاول مرة أخرى.");
  }
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
                      placeholder=" ابحث بالكود"
                      value={searchCode}
                      onChange={(e) => setSearchCode(e.target.value)}
                    />
                    <datalist id="codesList">
                      {products.map((p) => (
                        <option key={p.id} value={p.code} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className={styles.totals}>
                  <p>اجمالي الشراء: {totalBuy} EGP</p>
                  <p>اجمالي البيع: {totalSell} EGP</p>
                  <p>اجمالي المنتجات: {totalProducts} </p>
                </div>
                <tbody>
                  {([...filteredProducts].sort((a, b) => Number(a.code) - Number(b.code))).map((product) => {
                    const colorsList = product.colors || [];
                    let totalQ = 0;

                    // حساب الكمية الإجمالية لكل المنتج
                    colorsList.forEach(c => {
                      const colorTotal = (c.sizes && c.sizes.length)
                        ? c.sizes.reduce((s, it) => s + Number(it.qty || 0), 0)
                        : (c.quantity || 0);
                      totalQ += colorTotal;
                    });

                    return (
                      <tr key={product.id}>
                        <td>{product.code}</td>
                        <td>{product.name || "-"}</td>
                        <td>{product.buyPrice || 0} EGP</td>
                        <td>{product.sellPrice || 0} EGP</td>
                        <td>{product.finalPrice} EGP</td>
                        <td>{totalQ || product.quantity || 0}</td>

                        <td style={{ maxWidth: 150 }}>
                          {colorsList.length === 0 ? (
                            "-"
                          ) : (
                            colorsList.map(c => {
                              const colorTotal = (c.sizes && c.sizes.length)
                                ? c.sizes.reduce((s, it) => s + Number(it.qty || 0), 0)
                                : (c.quantity || 0);
                              return (
                                <div
                                  key={c.color}
                                  style={{
                                    whiteSpace: "nowrap",
                                    border: "1px solid #eee",
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    background: "#f9f9f9",
                                    fontSize: 14,
                                    marginBottom: 4
                                  }}
                                >
                                  <strong>{c.color}:</strong> {colorTotal}
                                </div>
                              );
                            })
                          )}
                        </td>

                        <td style={{ maxWidth: 300 }}>
                          {colorsList.length === 0 ? (
                            "-"
                          ) : (
                            colorsList.map(c => {
                              const detail = (c.sizes && c.sizes.length)
                                ? c.sizes.map(s => `${s.size}(${s.qty})`).join(", ")
                                : (c.quantity ? `كمية: ${c.quantity}` : "-");
                              return (
                                <div
                                  key={c.color}
                                  style={{
                                    whiteSpace: "nowrap",
                                    border: "1px solid #eee",
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    background: "#f9f9f9",
                                    fontSize: 14,
                                    marginBottom: 4
                                  }}
                                >
                                  <strong>{c.color}:</strong> {detail}
                                </div>
                              );
                            })
                          )}
                        </td>

                        <td>{product.date?.toDate ? product.date.toDate().toLocaleDateString("ar-EG") : product.date}</td>

                        <td className={styles.actions}>
                          <button onClick={() => handleDelete(product)}><FaRegTrashAlt /></button>
                          <button onClick={() => handleEdit(product)}><MdOutlineEdit /></button>
                          <button onClick={() => handlePrintLabel(product)}>🖨️</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>


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
                  <div className={styles.inputBox}>
                    <div className="inputContainer">
                      <label>السعر النهائي</label>
                      <input
                        type="number"
                        placeholder="ادخل السعر النهائي"
                        value={finalPrice}
                        onChange={(e) => setFinalPrice(e.target.value)}
                      />
                    </div>
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

                <div className={styles.inputBox}>
                  <button className={styles.manageBtn} onClick={() => openModalForCategory(form.category || 'اكسسوار')}>
                    تحرير الألوان والمقاسات
                  </button>
                </div>

                <div className={styles.colorsBox}>
                  <h4>تفاصيل الألوان والمقاسات</h4>
                  <div style={{ marginBottom: 10, fontWeight: 600 }}>
                    إجمالي الكمية قبل الإضافة: {computeTempColorsQty()}
                  </div>

                  {colors.length === 0 && <p className={styles.emptyState}>لم يتم اضافة الوان بعد</p>}
                  {colors.map((c, idx) => (
                    <div key={idx} className={styles.sizeRow}>
                      <strong>{c.color}</strong>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                        {c.sizes && c.sizes.length
                          ? c.sizes.map((s, si) => (
                            <div key={si} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #e0e0e0', background: '#fff', display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span>{s.size}</span>
                              <span style={{ fontWeight: 600 }}>{s.qty}</span>
                            </div>
                          ))
                          : <em style={{ color: '#666' }}>لا توجد مقاسات</em>}
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
                        const sample = ["أبيض", "أسود", "أحمر", "أزرق"];
                        setTempColors(prev => {
                          const copy = prev.map(c => ({ color: c.color, sizes: c.sizes.map(s => ({ ...s })) }));
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
                              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                <button onClick={() => addTempSizeToColor(ci)} className={styles.smallBtn}>➕ أضف مقاس لهذا اللون</button>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {c.sizes && c.sizes.length
                                  ? c.sizes.map((s, si) => (
                                    <div key={si} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, border: '1px solid #eee', background: '#fff' }}>
                                      <div style={{ fontWeight: 600 }}>{s.size}</div>
                                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                        <button onClick={() => decTempSizeQty(ci, s.size)} className={styles.smallBtn}><FaMinus /></button>
                                        <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 600 }}>{s.qty}</span>
                                        <button onClick={() => incTempSizeQty(ci, s.size)} className={styles.smallBtn}><FaPlus /></button>
                                        <button onClick={() => removeTempSizeFromColor(ci, s.size)} className={`${styles.smallBtn} ${styles.delete}`}><FaTrash /></button>
                                      </div>
                                    </div>
                                  ))
                                  : <div style={{ color: '#777' }}>لا توجد مقاسات لهذا اللون</div>}
                              </div>
                            </div>
                          </div>
                        ))}
                        {tempColors.length === 0 && <div className={styles.emptyState}>لم تضف ألوان بعد</div>}
                      </div>
                    </div>

                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button onClick={cancelModal} className={styles.btnOutline}>إلغاء</button>
                      <button onClick={saveModal} className={styles.btnPrimary}>حفظ</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </>
        )}
        {showDeletePopup && (
  <div className={styles.modalOverlay} onClick={() => setShowDeletePopup(false)}>
    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3>حذف جزء من المنتج — {deleteTarget?.name}</h3>
          <button onClick={() => setShowDeletePopup(false)} className={styles.closeBtn}>✖</button>
        </div>

        <div className={styles.modalSection}>
          {deleteForm.map((col, ci) => (
            <div key={ci} style={{ marginBottom: 20 }}>
              <h4 style={{ marginBottom: 10 }}>{col.color}</h4>

              {col.sizes.map((sz, si) => (
                <div
                  key={si}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 10px",
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    marginBottom: 8,
                    background: "#fff"
                  }}
                >
                  <div>
                    <strong>{sz.size}</strong> — موجود: {sz.qty}
                  </div>

                  <input
                    type="number"
                    min="0"
                    max={sz.qty}
                    value={sz.deleteQty}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setDeleteForm(prev => {
                        const copy = [...prev];
                        copy[ci].sizes[si].deleteQty = val;
                        return copy;
                      });
                    }}
                    style={{
                      width: 70,
                      padding: 6,
                      borderRadius: 6,
                      border: "1px solid #ccc"
                    }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={() => setShowDeletePopup(false)} className={styles.btnOutline}>إلغاء</button>
          <button onClick={confirmDeleteSelected} className={styles.btnPrimary}>حذف</button>
        </div>
      </div>
    </div>
  </div>
)}

      </div>
    </div>
  );
}

export default Products;
