"use client";
import SideBar from "@/components/SideBar/page";
import styles from "../products/styles.module.css";
import { useState, useEffect, useMemo, useCallback } from "react";
import { MdDriveFileRenameOutline } from "react-icons/md";
import { GiMoneyStack } from "react-icons/gi";
import { CiSearch } from "react-icons/ci";
import { FaRegTrashAlt } from "react-icons/fa";
import { MdOutlineEdit } from "react-icons/md";
import { FaRuler } from "react-icons/fa";
import { FaPlus, FaMinus, FaTrash } from "react-icons/fa6";
import { BiCategory } from "react-icons/bi";
import { FiCornerDownRight } from "react-icons/fi";
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
import {
  offlineAdd,
  offlineDelete,
  offlineUpdate,
} from "@/utils/firebaseOffline";
import Loader from "@/components/Loader/Loader";
import {
  NotificationProvider,
  useNotification,
} from "@/contexts/NotificationContext";
import { CONFIG } from "@/constants/config";
import InputModal from "../products/components/InputModal";
import ConfirmModal from "@/components/Main/Modals/ConfirmModal";

function StockContent() {
  const { success, error: showError, warning } = useNotification();
  const [auth, setAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(false);
  const [finalPrice, setFinalPrice] = useState("");
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchCode, setSearchCode] = useState("");
  const [totalBuy, setTotalBuy] = useState(0);
  const [totalSell, setTotalSell] = useState(0);
  const [finaltotal, setFinalTotal] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteForm, setDeleteForm] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [filterSection, setFilterSection] = useState("الكل");
  const [isSaving, setIsSaving] = useState(false);
  const [showAddQuantityModal, setShowAddQuantityModal] = useState(false);
  const [productToAddQuantity, setProductToAddQuantity] = useState(null);
  const [addQuantityValue, setAddQuantityValue] = useState("");
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [productToTransfer, setProductToTransfer] = useState(null);
  const [transferQuantity, setTransferQuantity] = useState("");
  const [form, setForm] = useState({
    name: "",
    buyPrice: "",
    sellPrice: "",
    color: "",
    sizeType: "",
    quantity: "",
    category: "",
    section: "",
    merchantName: "",
  });

  const [colors, setColors] = useState([]);
  const [editId, setEditId] = useState(null);

  const userName =
    typeof window !== "undefined" ? localStorage.getItem("userName") : "";

  const [showModal, setShowModal] = useState(false);
  const [modalCategory, setModalCategory] = useState("");
  const [modalSizeType, setModalSizeType] = useState("");
  const [tempColors, setTempColors] = useState([]);

  // Input Modal states
  const [inputModal, setInputModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    placeholder: "",
    defaultValue: "",
    type: "text",
    onConfirm: null,
    min: undefined,
    max: undefined,
  });

  const sizeGroups = {
    شبابي: ["36", "37", "38", "39", "40", "41"],
    رجالي: ["40", "41", "42", "43", "44", "45"],
    هدوم: ["S", "M", "L", "XL", "2XL"],
  };

  const router = useRouter();

  // Auth check (same as products)
  useEffect(() => {
    const checkLock = async () => {
      const userName = localStorage.getItem("userName");
      if (!userName) {
        router.push("/");
        return;
      }
      const q = query(
        collection(db, "users"),
        where("userName", "==", userName)
      );
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        router.push("/");
        return;
      }
      const user = querySnapshot.docs[0].data();
      if (user.permissions?.products === true) {
        showError("ليس لديك الصلاحية للوصول إلى هذه الصفحة");
        router.push("/");
        return;
      }
      setAuth(true);
      setLoading(false);
    };
    checkLock();
  }, [router, showError]);

  // Load stock products from stockProducts collection
  useEffect(() => {
    const shop = localStorage.getItem("shop");
    if (!shop) return;

    const q = query(
      collection(db, "stockProducts"),
      where("shop", "==", shop),
      where("type", "==", "product")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProducts(data);
      },
      (err) => {
        console.error("Error fetching stock products with snapshot:", err);
        showError(
          `حدث خطأ أثناء جلب منتجات المخزن: ${err.message || "خطأ غير معروف"}`
        );
      }
    );

    return () => unsubscribe();
  }, [showError]);

  // Helper function to compute total quantity from colors
  const computeTotalQtyFromColors = useCallback((colorsArr) => {
    if (!Array.isArray(colorsArr)) return 0;
    let total = 0;
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
  }, []);

  // Helper function to compute product quantity
  const computeProductQuantity = useCallback(
    (product) => {
      if (product.colors && product.colors.length) {
        return computeTotalQtyFromColors(product.colors);
      }
      return Number(product.quantity || 0);
    },
    [computeTotalQtyFromColors]
  );

  // Filtered products using useMemo
  const filteredProductsMemo = useMemo(() => {
    let filtered = products;

    if (searchCode.trim()) {
      filtered = filtered.filter((p) =>
        p.code
          ?.toString()
          .toLowerCase()
          .includes(searchCode.trim().toLowerCase())
      );
    }

    if (filterSection && filterSection !== "الكل") {
      filtered = filtered.filter((p) => p.section === filterSection);
    }

    return filtered;
  }, [products, searchCode, filterSection]);

  // Calculate totals using useMemo
  const totals = useMemo(() => {
    let totalQty = 0;
    let totalBuyAmount = 0;
    let totalSellAmount = 0;
    let finalTotalAmount = 0;

    filteredProductsMemo.forEach((product) => {
      const productQty = computeProductQuantity(product);
      totalQty += productQty;
      totalBuyAmount += (product.buyPrice || 0) * productQty;
      totalSellAmount += (product.sellPrice || 0) * productQty;
      finalTotalAmount += (product.finalPrice || 0) * productQty;
    });

    return {
      totalQty,
      totalBuy: totalBuyAmount,
      totalSell: totalSellAmount,
      finalTotal: finalTotalAmount,
    };
  }, [filteredProductsMemo, computeProductQuantity]);

  // Update state from memoized values
  useEffect(() => {
    setFilteredProducts(filteredProductsMemo);
    setTotalProducts(totals.totalQty);
    setTotalBuy(totals.totalBuy);
    setTotalSell(totals.totalSell);
    setFinalTotal(totals.finalTotal);
  }, [filteredProductsMemo, totals]);

  // Next code for stockProducts only
  const getNextCode = useCallback(async () => {
    const shop = localStorage.getItem("shop");
    if (!shop) return 1000;

    try {
      const q = query(
        collection(db, "stockProducts"),
        where("shop", "==", shop),
        where("type", "==", "product")
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) return 1000;

      const codes = snapshot.docs
        .map((doc) => Number(doc.data().code))
        .filter((code) => !isNaN(code) && code >= 1000);

      if (codes.length === 0) return 1000;

      const maxCode = Math.max(...codes);
      return maxCode + 1;
    } catch (err) {
      console.error("Error getting next stock code:", err);
      showError("حدث خطأ أثناء الحصول على الكود التالي للمخزن");
      return 1000;
    }
  }, [showError]);

  // Next code for main products collection (lacosteProducts)
  const getNextProductCode = useCallback(async () => {
    const shop = localStorage.getItem("shop");
    if (!shop) return 1000;

    try {
      const q = query(
        collection(db, "lacosteProducts"),
        where("shop", "==", shop),
        where("type", "==", "product")
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) return 1000;

      const codes = snapshot.docs
        .map((doc) => Number(doc.data().code))
        .filter((code) => !isNaN(code) && code >= 1000);

      if (codes.length === 0) return 1000;

      const maxCode = Math.max(...codes);
      return maxCode + 1;
    } catch (err) {
      console.error("Error getting next code for products:", err);
      showError("حدث خطأ أثناء الحصول على الكود التالي للمنتجات");
      return 1000;
    }
  }, [showError]);

  const computeTotalProducts = (productsArr) => {
    let total = 0;

    productsArr.forEach((product) => {
      let qty = 0;

      if (product.colors && product.colors.length) {
        qty = computeTotalQtyFromColors(product.colors);
      } else {
        qty = Number(product.quantity || 0);
      }

      total += qty;
    });

    return total;
  };

  const handleAddProduct = useCallback(async () => {
    if (!form.name.trim()) {
      showError("يرجى إدخال اسم المنتج");
      return;
    }

    if (!form.buyPrice || Number(form.buyPrice) <= 0) {
      showError("يرجى إدخال سعر شراء صحيح");
      return;
    }

    if (!form.sellPrice || Number(form.sellPrice) <= 0) {
      showError("يرجى إدخال سعر بيع صحيح");
      return;
    }

    if (!finalPrice || Number(finalPrice) <= 0) {
      showError("يرجى إدخال سعر نهائي صحيح");
      return;
    }

    const shop = localStorage.getItem("shop");
    if (!shop) {
      showError("حدث خطأ: المتجر غير محدد");
      return;
    }

    setIsSaving(true);
    try {
      const newCode = await getNextCode();

      const totalQty =
        colors && colors.length > 0
          ? computeTotalQtyFromColors(colors)
          : Number(form.quantity || 0);

      if (totalQty <= 0) {
        showError("يرجى إدخال كمية أكبر من صفر");
        setIsSaving(false);
        return;
      }

      const productObj = {
        code: newCode,
        name: form.name.trim(),
        buyPrice: Number(form.buyPrice),
        sellPrice: Number(form.sellPrice),
        finalPrice: Number(finalPrice),
        quantity: totalQty,
        colors: colors && colors.length > 0 ? colors : null,
        sizeType: form.sizeType || "",
        category: form.category || "",
        section: form.section || "",
        merchantName: form.merchantName || "",
        date: Timestamp.now(),
        shop: shop,
        type: "product",
      };

      await addDoc(collection(db, "stockProducts"), productObj);

      success("تم إضافة المنتج للمخزن بنجاح");

      setForm({
        name: "",
        buyPrice: "",
        sellPrice: "",
        color: "",
        sizeType: "",
        quantity: "",
        category: "",
        section: "",
        merchantName: "",
      });
      setFinalPrice("");
      setColors([]);
      setActive(false);
    } catch (err) {
      console.error("Error adding stock product:", err);
      showError(
        `حدث خطأ أثناء إضافة المنتج للمخزن: ${err.message || "خطأ غير معروف"}`
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    form,
    finalPrice,
    colors,
    getNextCode,
    computeTotalQtyFromColors,
    success,
    showError,
  ]);

  const handleDelete = (product) => {
    setProductToDelete(product);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;

    const product = productToDelete;
    const hasColors = product.colors && product.colors.length > 0;

    if (!hasColors) {
      try {
        const shop = localStorage.getItem("shop");
        const deletedQty = Number(product.quantity || 1);

        const deletedProductData = {
          name: product.name,
          buyPrice: Number(product.buyPrice) || 0,
          sellPrice: Number(product.sellPrice) || 0,
          deletedTotalQty: deletedQty,
          shop: product.shop || shop,
          code: product.code || "",
          type: product.type || "",
          deletedAt: new Date(),
        };

        const addResult = await offlineAdd(
          "deletedProducts",
          deletedProductData
        );

        const deleteResult = await offlineDelete(
          "stockProducts",
          product.id
        );

        setProducts((prev) => prev.filter((p) => p.id !== product.id));

        if (deleteResult.offline || addResult.offline) {
          success("تم حذف المنتج من المخزن (سيتم المزامنة عند الاتصال بالإنترنت)");
        } else {
          success("تم حذف المنتج من المخزن وحفظه في السجل بنجاح");
        }
      } catch (e) {
        console.error("Error deleting stock product:", e);
        showError(`حدث خطأ أثناء الحذف: ${e.message || "خطأ غير معروف"}`);
      }

      setShowDeleteConfirm(false);
      setProductToDelete(null);
      return;
    }

    setDeleteTarget(product);

    const formatted = (product.colors || []).map((c) => ({
      color: c.color,
      sizes: (c.sizes || []).map((s) => ({
        size: s.size,
        qty: s.qty,
        deleteQty: 0,
      })),
    }));

    setDeleteForm(formatted);
    setShowDeletePopup(true);

    setShowDeleteConfirm(false);
    setProductToDelete(null);
  };

  const computeTempColorsQty = () => {
    if (!tempColors || tempColors.length === 0)
      return Number(form.quantity) || 0;
    return tempColors.reduce((total, c) => {
      const colorQty =
        c.sizes && c.sizes.length
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
      merchantName: product.merchantName || "",
      section: product.section || "",
    });
    setFinalPrice(product.finalPrice);

    if (product.colors && product.colors.length) {
      const normalized = product.colors.map((c) => {
        if (Array.isArray(c.sizes)) {
          const sizes = c.sizes.map((s) => ({
            size: s.size || s.sizeName || s.name || String(s.size),
            qty: Number(s.qty ?? s.quantity ?? s.count ?? 0),
          }));
          return { color: c.color, sizes };
        } else if (c.quantity !== undefined) {
          return {
            color: c.color,
            sizes: [{ size: "الكمية", qty: Number(c.quantity || 0) }],
          };
        } else {
          return { color: c.color || "غير معروف", sizes: [] };
        }
      });
      setColors(normalized);
      setTempColors(
        normalized.map((c) => ({
          color: c.color,
          sizes: c.sizes.map((s) => ({ ...s })),
        }))
      );
    } else {
      setColors([]);
      setTempColors([]);
    }

    setActive("edit");
  };

  const handleUpdateProduct = async () => {
    if (!editId) return;

    const productRef = doc(db, "stockProducts", editId);
    const snap = await getDoc(productRef);
    const oldProduct = snap.data();

    const finalColors =
      colors && colors.length > 0
        ? colors
        : oldProduct.colors && oldProduct.colors.length > 0
        ? oldProduct.colors
        : null;

    let totalQty = 0;
    if (finalColors && finalColors.length > 0) {
      totalQty = computeTotalQtyFromColors(finalColors);
    } else {
      totalQty = Number(form.quantity || oldProduct.quantity || 0);
    }

    setIsSaving(true);
    try {
      await updateDoc(productRef, {
        name: form.name || "",
        buyPrice: Number(form.buyPrice) || 0,
        sellPrice: Number(form.sellPrice) || 0,
        finalPrice: Number(finalPrice) || 0,
        quantity: totalQty,
        colors: finalColors,
        sizeType: form.sizeType || oldProduct.sizeType || "",
        category: form.category || oldProduct.category || "",
        section: form.section || oldProduct.section || "",
        merchantName: form.merchantName || oldProduct.merchantName || "",
      });

      success("تم تحديث منتج المخزن بنجاح");

      setEditId(null);
      setForm({
        name: "",
        buyPrice: "",
        sellPrice: "",
        color: "",
        sizeType: "",
        quantity: "",
        category: "",
        section: "",
        merchantName: "",
      });
      setFinalPrice("");
      setColors([]);
      setActive(false);
    } catch (err) {
      console.error("Error updating stock product:", err);
      showError(
        `حدث خطأ أثناء تحديث منتج المخزن: ${
          err.message || "خطأ غير معروف"
        }`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const openModalForCategory = (category) => {
    setModalCategory(category);
    setModalSizeType(form.sizeType || "");
    setTempColors(
      colors.length
        ? colors.map((c) => ({
            color: c.color,
            sizes: c.sizes.map((s) => ({ ...s })),
          }))
        : []
    );
    setShowModal(true);
  };

  const handleCategorySelect = (category) => {
    setForm((prev) => ({ ...prev, category }));
    if (category && category !== "اكسسوار") {
      openModalForCategory(category);
    } else {
      setColors([]);
      setTempColors([]);
    }
  };

  const addTempColor = useCallback(() => {
    setInputModal({
      isOpen: true,
      title: "إضافة لون جديد",
      message: "اكتب اسم اللون الجديد",
      placeholder: "مثال: أحمر، أزرق، أسود",
      defaultValue: "",
      type: "text",
      onConfirm: (newColor) => {
        if (!newColor || !newColor.trim()) return;
        setTempColors((prev) => {
          const exists = prev.find(
            (p) => p.color.toLowerCase() === newColor.trim().toLowerCase()
          );
          if (exists) {
            warning("هذا اللون موجود بالفعل");
            return prev;
          }
          return [...prev, { color: newColor.trim(), sizes: [] }];
        });
        setInputModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  }, [warning]);

  const removeTempColor = (colorName) => {
    setTempColors((prev) => prev.filter((c) => c.color !== colorName));
  };

  const addTempSizeToColor = useCallback((colorIndex) => {
    setInputModal({
      isOpen: true,
      title: "إضافة مقاس",
      message: "اكتب اسم المقاس",
      placeholder: "مثال: M أو 42",
      defaultValue: "",
      type: "text",
      onConfirm: (sizeName) => {
        if (!sizeName || !sizeName.trim()) return;
        setInputModal({
          isOpen: true,
          title: "إضافة كمية",
          message: `اكتب الكمية للمقاس ${sizeName.trim()}`,
          placeholder: "الكمية",
          defaultValue: "1",
          type: "number",
          min: 1,
          onConfirm: (qtyStr) => {
            const qty = Math.max(1, Number(qtyStr || 1));
            setTempColors((prev) => {
              const copy = prev.map((c) => ({
                color: c.color,
                sizes: c.sizes.map((s) => ({ ...s })),
              }));
              const target = copy[colorIndex];
              const existing = target.sizes.find(
                (s) => s.size === sizeName.trim()
              );
              if (existing) {
                existing.qty = Number(existing.qty || 0) + qty;
              } else {
                target.sizes.push({ size: sizeName.trim(), qty });
              }
              return copy;
            });
            setInputModal((prev) => ({ ...prev, isOpen: false }));
          },
        });
      },
    });
  }, []);

  const incTempSizeQty = (colorIndex, sizeName) => {
    setTempColors((prev) =>
      prev.map((c, ci) => {
        if (ci !== colorIndex) return c;
        return {
          ...c,
          sizes: c.sizes.map((s) =>
            s.size === sizeName ? { ...s, qty: Number(s.qty || 0) + 1 } : s
          ),
        };
      })
    );
  };

  const decTempSizeQty = (colorIndex, sizeName) => {
    setTempColors((prev) =>
      prev.map((c, ci) => {
        if (ci !== colorIndex) return c;
        return {
          ...c,
          sizes: c.sizes.map((s) =>
            s.size === sizeName
              ? { ...s, qty: Math.max(0, Number(s.qty || 0) - 1) }
              : s
          ),
        };
      })
    );
  };

  const removeTempSizeFromColor = (colorIndex, sizeName) => {
    setTempColors((prev) =>
      prev.map((c, ci) => {
        if (ci !== colorIndex) return c;
        return { ...c, sizes: c.sizes.filter((s) => s.size !== sizeName) };
      })
    );
  };

  const addPresetSizesToColor = (colorIndex) => {
    const group =
      modalCategory === "احذية" && modalSizeType
        ? sizeGroups[modalSizeType]
        : modalCategory === "هدوم"
        ? sizeGroups["هدوم"]
        : [];
    if (!group.length) {
      warning("لا توجد مجموعة جاهزة للصنف/نوع المقاس الحالي");
      return;
    }
    setTempColors((prev) => {
      const copy = prev.map((c) => ({
        color: c.color,
        sizes: c.sizes.map((s) => ({ ...s })),
      }));
      const target = copy[colorIndex];
      group.forEach((sz) => {
        if (!target.sizes.find((s) => s.size === sz)) {
          target.sizes.push({ size: sz, qty: 1 });
        }
      });
      return copy;
    });
  };

  const saveModal = () => {
    const cleaned = tempColors
      .map((c) => ({
        color: c.color,
        sizes: (c.sizes || [])
          .filter((s) => Number(s.qty || 0) > 0)
          .map((s) => ({ size: s.size, qty: Number(s.qty || 0) })),
      }))
      .filter((c) => c.color && c.sizes && c.sizes.length > 0);

    setColors(cleaned);
    setForm((prev) => ({ ...prev, sizeType: modalSizeType }));
    setShowModal(false);
  };

  const cancelModal = () => {
    setTempColors([]);
    setShowModal(false);
  };

  const handlePrintLabel = useCallback(
    (product) => {
      try {
        if (typeof window === "undefined") return;
        const printWindow = window.open("", "", "width=400,height=300");
        if (!printWindow) {
          showError("تم منع نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة");
          return;
        }
        const htmlContent = `
      <html>
        <head>
          <meta charset=\"utf-8\" />
          <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
          <script src=\"https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js\"></script>
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
          <div class=\"label\">
          <div class=\"container\">
          <div class=\"name\">${product.name ?? ""}</div>
          </div>
            
            <svg id=\"barcode\" class=\"barcode\"></svg>
            <div class=\"price\">${product.code ?? ""} </div>
          </div>
          <script>
            window.onload = function () {
              JsBarcode(\"#barcode\", \"${product.code}\", {
                format: \"CODE128\",
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
      } catch (err) {
        console.error("Error printing label:", err);
        showError(
          `حدث خطأ أثناء الطباعة: ${err.message || "خطأ غير معروف"}`
        );
      }
    },
    [showError]
  );

  // Handle add quantity (no wared side-effect)
  const handleAddQuantity = (product) => {
    setProductToAddQuantity(product);
    setAddQuantityValue("");
    setShowAddQuantityModal(true);
  };

  const handleConfirmAddQuantity = async () => {
    if (!productToAddQuantity) return;

    const quantityToAdd = Number(addQuantityValue);
    if (isNaN(quantityToAdd) || quantityToAdd <= 0) {
      showError("يرجى إدخال كمية صحيحة أكبر من صفر");
      return;
    }

    const shop = localStorage.getItem("shop");
    if (!shop) {
      showError("حدث خطأ: المتجر غير محدد");
      return;
    }

    setIsSaving(true);
    try {
      const productRef = doc(db, "stockProducts", productToAddQuantity.id);
      const productSnap = await getDoc(productRef);

      if (!productSnap.exists()) {
        showError("المنتج غير موجود");
        return;
      }

      const productData = productSnap.data();
      const currentQuantity = computeProductQuantity(productToAddQuantity);
      const newQuantity = currentQuantity + quantityToAdd;

      let updatedData = { ...productData };

      if (productData.colors && productData.colors.length > 0) {
        const updatedColors = productData.colors.map((c, idx) => {
          if (idx === 0) {
            if (c.sizes && c.sizes.length > 0) {
              return {
                ...c,
                sizes: c.sizes.map((s, sIdx) =>
                  sIdx === 0
                    ? { ...s, qty: (s.qty || 0) + quantityToAdd }
                    : s
                ),
              };
            } else {
              return {
                ...c,
                quantity: (c.quantity || 0) + quantityToAdd,
              };
            }
          }
          return c;
        });
        updatedData.colors = updatedColors;
        updatedData.quantity = newQuantity;
      } else {
        updatedData.quantity = newQuantity;
      }

      await updateDoc(productRef, updatedData);

      setProducts((prev) =>
        prev.map((p) =>
          p.id === productToAddQuantity.id ? { ...p, quantity: newQuantity } : p
        )
      );

      success(
        `تم إضافة ${quantityToAdd} قطعة بنجاح للمخزن. الكمية الجديدة: ${newQuantity}`
      );

      setShowAddQuantityModal(false);
      setProductToAddQuantity(null);
      setAddQuantityValue("");
    } catch (err) {
      console.error("Error adding stock quantity:", err);
      showError(
        `حدث خطأ أثناء إضافة الكمية للمخزن: ${
          err.message || "خطأ غير معروف"
        }`
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Transfer from stock to main products
  const handleOpenTransfer = (product) => {
    setProductToTransfer(product);
    setTransferQuantity("");
    setShowTransferModal(true);
  };

  const handleConfirmTransfer = useCallback(async () => {
    if (!productToTransfer) return;

    const qty = Number(transferQuantity);
    if (isNaN(qty) || qty <= 0) {
      showError("يرجى إدخال كمية صحيحة أكبر من صفر للنقل");
      return;
    }

    // حاليًا ندعم النقل للمنتجات بدون ألوان/مقاسات فقط
    if (productToTransfer.colors && productToTransfer.colors.length > 0) {
      showError(
        "حاليًا لا يمكن نقل المنتجات التي تحتوي على ألوان/مقاسات من المخزن"
      );
      return;
    }

    const available = computeProductQuantity(productToTransfer);
    if (qty > available) {
      showError(
        `الكمية المطلوبة للنقل (${qty}) أكبر من الكمية في المخزن (${available})`
      );
      return;
    }

    const shop = localStorage.getItem("shop");
    if (!shop) {
      showError("حدث خطأ: المتجر غير محدد");
      return;
    }

    setIsSaving(true);
    try {
      // 1) احصل على الكود التالي في صفحة المنتجات
      const newProductCode = await getNextProductCode();

      // 2) أنشئ منتج جديد في lacosteProducts بالكمية المنقولة فقط
      const base = productToTransfer;
      const newProduct = {
        code: newProductCode,
        name: base.name,
        buyPrice: Number(base.buyPrice) || 0,
        sellPrice: Number(base.sellPrice) || 0,
        finalPrice: Number(base.finalPrice) || Number(base.sellPrice) || 0,
        quantity: qty,
        colors: null, // لا ندعم النقل مع الألوان حالياً
        sizeType: base.sizeType || "",
        category: base.category || "",
        section: base.section || "",
        merchantName: base.merchantName || "",
        date: Timestamp.now(),
        shop,
        type: "product",
      };

      await addDoc(collection(db, "lacosteProducts"), newProduct);

      // 3) تحديث منتج المخزن (طرح الكمية المنقولة أو حذف المنتج لو صفر)
      const remaining = available - qty;
      const stockRef = doc(db, "stockProducts", base.id);

      if (remaining <= 0) {
        await deleteDoc(stockRef);
        setProducts((prev) => prev.filter((p) => p.id !== base.id));
      } else {
        await updateDoc(stockRef, { quantity: remaining });
        setProducts((prev) =>
          prev.map((p) =>
            p.id === base.id ? { ...p, quantity: remaining } : p
          )
        );
      }

      success(
        `تم نقل ${qty} قطعة من المخزن إلى صفحة المنتجات بكود جديد ${newProductCode}`
      );
      setShowTransferModal(false);
      setProductToTransfer(null);
      setTransferQuantity("");
    } catch (err) {
      console.error("Error transferring stock product:", err);
      showError(
        `حدث خطأ أثناء نقل المنتج من المخزن: ${
          err.message || "خطأ غير معروف"
        }`
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    productToTransfer,
    transferQuantity,
    computeProductQuantity,
    getNextProductCode,
    showError,
    success,
  ]);

  const confirmDeleteSelected = async () => {
    if (!deleteTarget || !deleteForm.length) return;

    const shop = localStorage.getItem("shop");

    const deletedList = [];
    let deletedTotalQty = 0;
    let deletedTotalValue = 0;

    for (let ci = 0; ci < deleteForm.length; ci++) {
      const color = deleteForm[ci];
      for (let si = 0; si < color.sizes.length; si++) {
        const size = color.sizes[si];
        const dq = Number(size.deleteQty || 0);
        const available = Number(size.qty || 0);

        if (dq > 0) {
          if (dq > available) {
            showError(
              `لا يمكنك حذف أكثر من الكمية الموجودة للمقاس ${size.size} (اللون ${color.color})`
            );
            return;
          }

          deletedList.push({
            color: color.color,
            size: size.size,
            qty: dq,
          });

          deletedTotalQty += dq;
          const buyPrice = Number(deleteTarget.buyPrice || 0);
          deletedTotalValue += buyPrice * dq;
        }
      }
    }

    if (deletedList.length === 0) {
      warning("لم تحدد أي كميات للحذف");
      return;
    }

    try {
      const deletedProductData = {
        ...deleteTarget,
        deletedParts: deletedList,
        deletedTotalQty,
        deletedTotalValue,
        deletedAt: Timestamp.now(),
        originalId: deleteTarget.id,
        shop,
      };
      const addResult = await offlineAdd("deletedProducts", deletedProductData);

      let updatedColors = deleteTarget.colors.map((c) => ({
        color: c.color,
        sizes: c.sizes.map((s) => ({ ...s })),
      }));

      deletedList.forEach((del) => {
        const col = updatedColors.find((c) => c.color === del.color);
        if (!col) return;
        const size = col.sizes.find(
          (s) => String(s.size) === String(del.size)
        );
        if (!size) return;
        size.qty = Number(size.qty || 0) - Number(del.qty || 0);
      });

      updatedColors = updatedColors
        .map((c) => ({
          color: c.color,
          sizes: c.sizes.filter((s) => Number(s.qty || 0) > 0),
        }))
        .filter((c) => c.sizes.length > 0);

      if (updatedColors.length === 0) {
        const deleteResult = await offlineDelete(
          "stockProducts",
          deleteTarget.id
        );
        setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      } else {
        const newQuantity = updatedColors.reduce(
          (t, c) => t + c.sizes.reduce((s, x) => s + Number(x.qty || 0), 0),
          0
        );

        await offlineUpdate("stockProducts", deleteTarget.id, {
          colors: updatedColors,
          quantity: newQuantity,
        });

        setProducts((prev) =>
          prev.map((p) =>
            p.id === deleteTarget.id
              ? { ...p, colors: updatedColors, quantity: newQuantity }
              : p
          )
        );
      }

      setShowDeletePopup(false);
      setDeleteTarget(null);
      setDeleteForm([]);

      const isOffline = addResult.offline;
      if (isOffline) {
        success(
          `تم حذف ${deletedTotalQty} قطعة من المخزن (سيتم المزامنة عند الاتصال بالإنترنت)`
        );
      } else {
        success(
          `تم حذف ${deletedTotalQty} قطعة من المخزن (قيمة تقريبية: ${deletedTotalValue.toFixed(
            2
          )} EGP كقيمة شراء)`
        );
      }
    } catch (err) {
      console.error("خطأ أثناء عملية الحذف الجزئي من المخزن:", err);
      showError(
        `حدث خطأ أثناء حذف العناصر من المخزن: ${
          err.message || "خطأ غير معروف"
        }`
      );
    }
  };

  if (loading) return <Loader />;
  if (!auth) return null;

  return (
    <div className={styles.products}>
      <SideBar />
      <div className={styles.content}>
        {!active && (
          <div className={styles.stockMenu}>
            {/* Header */}
            <div className={styles.menuHeader}>
              <h1 className={styles.menuTitle}>المخزن</h1>
              <div className={styles.headerControls}>
                {/* Filter Dropdown */}
                <div className={styles.filterDropdown}>
                  <select
                    value={filterSection}
                    onChange={(e) => setFilterSection(e.target.value)}
                    className={styles.filterSelect}
                  >
                    <option value="الكل">الكل</option>
                    <option value="جينز">جينز</option>
                    <option value="تيشيرت">تيشيرت</option>
                    <option value="شروال">شروال</option>
                    <option value="جاكت">جاكت</option>
                    <option value="قميص">قميص</option>
                    <option value="ترينج">ترينج</option>
                    <option value="اندر شيرت">اندر شيرت</option>
                  </select>
                </div>

                {/* Search Box */}
                <div className={styles.searchContainer}>
                  <CiSearch className={styles.searchIcon} />
                  <input
                    type="text"
                    list="stockCodesList"
                    placeholder="بحث..."
                    value={searchCode}
                    onChange={(e) => setSearchCode(e.target.value)}
                    className={styles.searchInput}
                  />
                  <datalist id="stockCodesList">
                    {products.map((p) => (
                      <option key={p.id} value={p.code} />
                    ))}
                  </datalist>
                </div>

                {/* Add Button */}
                <button
                  className={styles.addStockBtn}
                  onClick={() => {
                    setActive(true);
                    setEditId(null);
                  }}
                >
                  <FaPlus className={styles.addIcon} />
                  <span>إضافة منتج للمخزن</span>
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className={styles.summaryCards}>
              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>إجمالي الشراء</span>
                <span className={styles.summaryValue}>
                  {totalBuy.toFixed(2)} EGP
                </span>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>إجمالي البيع</span>
                <span className={styles.summaryValue}>
                  {totalSell.toFixed(2)} EGP
                </span>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>إجمالي النهائي</span>
                <span className={styles.summaryValue}>
                  {finaltotal.toFixed(2)} EGP
                </span>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>إجمالي المنتجات</span>
                <span className={styles.summaryValue}>
                  {totalProducts} قطعة
                </span>
              </div>
            </div>

            {/* Products Table */}
            <div className={styles.tableWrapper}>
              <table className={styles.productsTable}>
                <thead>
                  <tr>
                    <th>الكود</th>
                    <th>الاسم</th>
                    <th>القسم</th>
                    <th>اسم التاجر</th>
                    <th>سعر الشراء</th>
                    <th>سعر البيع</th>
                    <th>السعر النهائي</th>
                    <th>الكمية</th>
                    <th>الألوان</th>
                    <th>خيارات</th>
                  </tr>
                </thead>
                <tbody>
                  {[...filteredProducts]
                    .sort((a, b) => Number(a.code) - Number(b.code))
                    .map((product) => {
                      const colorsList = product.colors || [];
                      let totalQ = 0;

                      colorsList.forEach((c) => {
                        const colorTotal =
                          c.sizes && c.sizes.length
                            ? c.sizes.reduce(
                                (s, it) => s + Number(it.qty || 0),
                                0
                              )
                            : c.quantity || 0;
                        totalQ += colorTotal;
                      });

                      return (
                        <tr key={product.id}>
                          <td className={styles.codeCell}>{product.code}</td>
                          <td className={styles.nameCell}>
                            {product.name || "-"}
                          </td>
                          <td className={styles.sectionCell}>
                            <span className={styles.sectionBadge}>
                              {product.section || "-"}
                            </span>
                          </td>
                          <td>{product.merchantName || "-"}</td>
                          <td className={styles.priceCell}>
                            {product.buyPrice || 0} EGP
                          </td>
                          <td className={styles.priceCell}>
                            {product.sellPrice || 0} EGP
                          </td>
                          <td className={styles.priceCell}>
                            {product.finalPrice} EGP
                          </td>
                          <td className={styles.stockCell}>
                            <span className={styles.stockBadge}>
                              {totalQ || product.quantity || 0}
                            </span>
                          </td>
                          {/* Colors */}
                          <td className={styles.colorsCell}>
                            {colorsList.length === 0 ? (
                              <span className={styles.emptyText}>-</span>
                            ) : (
                              <div className={styles.colorsList}>
                                {colorsList.map((c) => {
                                  const colorTotal =
                                    c.sizes && c.sizes.length
                                      ? c.sizes.reduce(
                                          (s, it) => s + Number(it.qty || 0),
                                          0
                                        )
                                      : c.quantity || 0;

                                  const sizesDetails =
                                    c.sizes && c.sizes.length
                                      ? c.sizes
                                          .map(
                                            (s) => `${s.size}: ${s.qty}`
                                          )
                                          .join(", ")
                                      : c.quantity
                                      ? `الكمية: ${c.quantity}`
                                      : "لا توجد مقاسات";

                                  return (
                                    <div
                                      key={c.color}
                                      className={styles.colorTagContainer}
                                    >
                                      <span
                                        className={styles.colorTag}
                                        title={sizesDetails}
                                      >
                                        {c.color} ({colorTotal})
                                      </span>
                                      <div className={styles.colorTooltip}>
                                        <div className={styles.tooltipHeader}>
                                          <strong>{c.color}</strong>
                                          <span className={styles.tooltipTotal}>
                                            إجمالي: {colorTotal}
                                          </span>
                                        </div>
                                        <div className={styles.tooltipSizes}>
                                          {c.sizes && c.sizes.length ? (
                                            c.sizes.map((s, idx) => (
                                              <div
                                                key={idx}
                                                className={
                                                  styles.tooltipSizeItem
                                                }
                                              >
                                                <span
                                                  className={
                                                    styles.tooltipSizeName
                                                  }
                                                >
                                                  {s.size}
                                                </span>
                                                <span
                                                  className={
                                                    styles.tooltipSizeQty
                                                  }
                                                >
                                                  {s.qty}
                                                </span>
                                              </div>
                                            ))
                                          ) : c.quantity ? (
                                            <div
                                              className={
                                                styles.tooltipSizeItem
                                              }
                                            >
                                              <span
                                                className={
                                                  styles.tooltipSizeName
                                                }
                                              >
                                                الكمية
                                              </span>
                                              <span
                                                className={
                                                  styles.tooltipSizeQty
                                                }
                                              >
                                                {c.quantity}
                                              </span>
                                            </div>
                                          ) : (
                                            <div
                                              className={styles.tooltipEmpty}
                                            >
                                              لا توجد مقاسات
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          {/* Actions */}
                          <td className={styles.actions}>
                            <div className={styles.actionButtons}>
                              {CONFIG.ADMIN_EMAILS.includes(userName) && (
                                <>
                                  <button
                                    className={styles.actionBtn}
                                    onClick={() => handleEdit(product)}
                                    title="تعديل"
                                  >
                                    <MdOutlineEdit />
                                  </button>
                                  <button
                                    className={`${styles.actionBtn} ${styles.deleteBtn}`}
                                    onClick={() => handleDelete(product)}
                                    title="حذف"
                                  >
                                    <FaRegTrashAlt />
                                  </button>
                                </>
                              )}
                              <button
                                className={styles.actionBtn}
                                onClick={() => handlePrintLabel(product)}
                                title="طباعة"
                              >
                                🖨️
                              </button>
                              <button
                                className={styles.actionBtn}
                                onClick={() => handleOpenTransfer(product)}
                                title="نقل للمنتجات"
                              >
                                <FiCornerDownRight />
                              </button>
                            </div>
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
                <label>
                  <MdDriveFileRenameOutline />
                </label>
                <input
                  type="text"
                  placeholder="اسم المنتج"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                />
              </div>
            </div>

            <div className={styles.inputBox}>
              <div className="inputContainer">
                <label>
                  <GiMoneyStack />
                </label>
                <input
                  type="number"
                  placeholder="سعر الشراء"
                  value={form.buyPrice}
                  onChange={(e) =>
                    setForm({ ...form, buyPrice: e.target.value })
                  }
                />
              </div>
              <div className="inputContainer">
                <label>
                  <GiMoneyStack />
                </label>
                <input
                  type="number"
                  placeholder="سعر البيع"
                  value={form.sellPrice}
                  onChange={(e) =>
                    setForm({ ...form, sellPrice: e.target.value })
                  }
                />
              </div>
              <div className={styles.inputBox}>
                <div className="inputContainer">
                  <label>
                    <GiMoneyStack />
                  </label>
                  <input
                    type="number"
                    placeholder="ادخل السعر النهائي"
                    value={finalPrice}
                    onChange={(e) => setFinalPrice(e.target.value)}
                  />
                </div>
                <div className={styles.inputBox}>
                  <div className="inputContainer">
                    <label>
                      <MdDriveFileRenameOutline />
                    </label>
                    <input
                      type="text"
                      placeholder="اسم التاجر"
                      value={form.merchantName}
                      onChange={(e) =>
                        setForm({ ...form, merchantName: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.inputBox}>
              <div className="inputContainer">
                <label>
                  <BiCategory />
                </label>
                <select
                  value={form.section}
                  onChange={(e) =>
                    setForm({ ...form, section: e.target.value })
                  }
                >
                  <option value="">اختر القسم</option>
                  <option value="جينز">جينز</option>
                  <option value="تيشيرت">تيشيرت</option>
                  <option value="شروال">شروال</option>
                  <option value="جاكت">جاكت</option>
                  <option value="قميص">قميص</option>
                  <option value="ترينج">ترينج</option>
                  <option value="اندر شيرت">اندر شيرت</option>
                </select>
              </div>
            </div>

            <div className={styles.inputBox}>
              <div className="inputContainer">
                <label>
                  <BiCategory />
                </label>
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
                  <label>
                    <FaRuler />
                  </label>
                  <select
                    value={form.sizeType}
                    onChange={(e) =>
                      setForm({ ...form, sizeType: e.target.value })
                    }
                  >
                    <option value="">اختر نوع المقاس</option>
                    <option value="شبابي">شبابي</option>
                    <option value="رجالي">رجالي</option>
                  </select>
                  <small className={styles.hint}>
                    لم يتم اختيار الوان بعد
                  </small>
                </div>
              </div>
            )}

            {form.category && form.category !== "اكسسوار" && (
              <div className={styles.inputBox}>
                <button
                  className={styles.manageBtn}
                  onClick={() => openModalForCategory(form.category)}
                >
                  تحرير الألوان والمقاسات
                </button>
              </div>
            )}

            <div className={styles.colorsBox}>
              <h4>تفاصيل الألوان والمقاسات</h4>
              <div className={styles.totalQtyInfo}>
                إجمالي الكمية قبل الإضافة: {computeTempColorsQty()}
              </div>

              {colors.length === 0 && (
                <p className={styles.emptyState}>لم يتم اضافة الوان بعد</p>
              )}
              {colors.map((c, idx) => (
                <div key={idx} className={styles.sizeRow}>
                  <strong className={styles.colorName}>{c.color}</strong>
                  <div className={styles.sizesPreviewContainer}>
                    {c.sizes && c.sizes.length ? (
                      c.sizes.map((s, si) => (
                        <div key={si} className={styles.sizePreviewBadge}>
                          <span>{s.size}</span>
                          <span className={styles.sizePreviewQty}>
                            {s.qty}
                          </span>
                        </div>
                      ))
                    ) : (
                      <em className={styles.emptySizeText}>
                        لا توجد مقاسات
                      </em>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {form.category === "اكسسوار" && (
              <div className={styles.inputBox}>
                <div className="inputContainer">
                  <label>
                    <FaPlus />
                  </label>
                  <input
                    type="number"
                    placeholder="الكمية"
                    value={form.quantity}
                    onChange={(e) =>
                      setForm({ ...form, quantity: e.target.value })
                    }
                  />
                </div>
              </div>
            )}

            <div className={styles.actionButtonsContainer}>
              {active === "edit" ? (
                <button
                  className={styles.addBtn}
                  onClick={handleUpdateProduct}
                >
                  تحديث منتج المخزن
                </button>
              ) : (
                <button className={styles.addBtn} onClick={handleAddProduct}>
                  اضف المنتج للمخزن
                </button>
              )}
              <button
                className={styles.viewAllBtn}
                onClick={() => {
                  setActive(false);
                  setEditId(null);
                }}
              >
                كل منتجات المخزن
              </button>
            </div>
          </div>
        )}

        {showModal && (
          <div className={styles.modalOverlay} onClick={cancelModal}>
            <div
              className={styles.modal}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                  <h3>
                    اعدادات الألوان والمقاسات — {modalCategory || "الصنف"}
                  </h3>
                  <button onClick={cancelModal} className={styles.closeBtn}>
                    ✖
                  </button>
                </div>

                <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                  <button onClick={addTempColor} className={styles.smallBtn}>
                    ➕ أضف لون
                  </button>
                  <button
                    onClick={() => {
                      const sample = ["أبيض", "أسود", "أحمر", "أزرق"];
                      setTempColors((prev) => {
                        const copy = prev.map((c) => ({
                          color: c.color,
                          sizes: c.sizes.map((s) => ({ ...s })),
                        }));
                        sample.forEach((col) => {
                          if (!copy.find((c) => c.color === col))
                            copy.push({ color: col, sizes: [] });
                        });
                        return copy;
                      });
                    }}
                    className={styles.smallBtn}
                  >
                    أضف ألوان تجريبية
                  </button>
                  {modalCategory === "احذية" && (
                    <select
                      value={modalSizeType}
                      onChange={(e) => setModalSizeType(e.target.value)}
                      className={styles.modalSelect}
                    >
                      <option value="">
                        نوع المقاس (اختياري)
                      </option>
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

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(220px, 1fr))",
                      gap: 12,
                      marginTop: 10,
                    }}
                  >
                    {tempColors.map((c, ci) => (
                      <div key={ci} className={styles.gridItem}>
                        <div className={styles.colorHeader}>
                          <div className={styles.colorName}>{c.color}</div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => addPresetSizesToColor(ci)}
                              className={styles.smallBtn}
                            >
                              إضافة جاهزة
                            </button>
                            <button
                              onClick={() => removeTempColor(c.color)}
                              className={`${styles.smallBtn} ${styles.delete}`}
                            >
                              حذف
                            </button>
                          </div>
                        </div>
                        <div className={styles.colorContent}>
                          <div className={styles.addSizeBtnContainer}>
                            <button
                              onClick={() => addTempSizeToColor(ci)}
                              className={styles.smallBtn}
                            >
                              ➕ أضف مقاس لهذا اللون
                            </button>
                          </div>
                          <div className={styles.sizesContainer}>
                            {c.sizes && c.sizes.length ? (
                              c.sizes.map((s, si) => (
                                <div key={si} className={styles.sizeRow}>
                                  <div className={styles.sizeName}>
                                    {s.size}
                                  </div>
                                  <div className={styles.sizeControls}>
                                    <button
                                      onClick={() => decTempSizeQty(ci, s.size)}
                                      className={styles.smallBtn}
                                    >
                                      <FaMinus />
                                    </button>
                                    <span className={styles.qtyDisplay}>
                                      {s.qty}
                                    </span>
                                    <button
                                      onClick={() => incTempSizeQty(ci, s.size)}
                                      className={styles.smallBtn}
                                    >
                                      <FaPlus />
                                    </button>
                                    <button
                                      onClick={() =>
                                        removeTempSizeFromColor(ci, s.size)
                                      }
                                      className={`${styles.smallBtn} ${styles.delete}`}
                                    >
                                      <FaTrash />
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className={styles.emptySizeText}>
                                لا توجد مقاسات لهذا اللون
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {tempColors.length === 0 && (
                      <div className={styles.emptyState}>
                        لم تضف ألوان بعد
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                  }}
                >
                  <button onClick={cancelModal} className={styles.btnOutline}>
                    إلغاء
                  </button>
                  <button onClick={saveModal} className={styles.btnPrimary}>
                    حفظ
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showDeletePopup && (
          <div
            className={styles.modalOverlay}
            onClick={() => setShowDeletePopup(false)}
          >
            <div
              className={styles.modal}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                  <h3>حذف جزء من منتج المخزن — {deleteTarget?.name}</h3>
                  <button
                    onClick={() => setShowDeletePopup(false)}
                    className={styles.closeBtn}
                  >
                    ✖
                  </button>
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
                            background: "#fff",
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
                              setDeleteForm((prev) => {
                                const copy = [...prev];
                                copy[ci].sizes[si].deleteQty = val;
                                return copy;
                              });
                            }}
                            style={{
                              width: 70,
                              padding: 6,
                              borderRadius: 6,
                              border: "1px solid #ccc",
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 10,
                  }}
                >
                  <button
                    onClick={() => setShowDeletePopup(false)}
                    className={styles.btnOutline}
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={confirmDeleteSelected}
                    className={styles.btnPrimary}
                  >
                    حذف
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Modal */}
      <InputModal
        isOpen={inputModal.isOpen}
        onClose={() => setInputModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={(value) => {
          if (inputModal.onConfirm) {
            inputModal.onConfirm(value);
          }
          setInputModal((prev) => ({ ...prev, isOpen: false }));
        }}
        title={inputModal.title}
        message={inputModal.message}
        placeholder={inputModal.placeholder}
        defaultValue={inputModal.defaultValue}
        type={inputModal.type}
        min={inputModal.min}
        max={inputModal.max}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setProductToDelete(null);
        }}
        title="تأكيد الحذف"
        message={
          productToDelete
            ? `هل أنت متأكد أنك تريد حذف المنتج من المخزن \"${productToDelete.name}\" (كود: ${productToDelete.code})؟`
            : "هل أنت متأكد أنك تريد حذف هذا المنتج من المخزن؟"
        }
        onConfirm={handleConfirmDelete}
        confirmText="حذف"
        cancelText="إلغاء"
        type="danger"
      />

      {/* Add Quantity Modal */}
      {showAddQuantityModal && productToAddQuantity && (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            setShowAddQuantityModal(false);
            setProductToAddQuantity(null);
            setAddQuantityValue("");
          }}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3>إضافة كمية - {productToAddQuantity.name}</h3>
                <button
                  onClick={() => {
                    setShowAddQuantityModal(false);
                    setProductToAddQuantity(null);
                    setAddQuantityValue("");
                  }}
                  className={styles.closeBtn}
                >
                  ✖
                </button>
              </div>

              <div className={styles.modalSection}>
                <p style={{ marginBottom: "15px", color: "#666" }}>
                  الكمية الحالية في المخزن:{" "}
                  <strong>{computeProductQuantity(productToAddQuantity)}</strong>
                </p>
                <div className="inputContainer">
                  <label>
                    <FaPlus />
                  </label>
                  <input
                    type="number"
                    placeholder="أدخل الكمية المضافة"
                    value={addQuantityValue}
                    onChange={(e) => setAddQuantityValue(e.target.value)}
                    min="1"
                    autoFocus
                  />
                </div>
              </div>

              <div
                style={{
                  marginTop: "12px",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "8px",
                }}
              >
                <button
                  onClick={() => {
                    setShowAddQuantityModal(false);
                    setProductToAddQuantity(null);
                    setAddQuantityValue("");
                  }}
                  className={styles.btnOutline}
                  disabled={isSaving}
                >
                  إلغاء
                </button>
                <button
                  onClick={handleConfirmAddQuantity}
                  className={styles.btnPrimary}
                  disabled={
                    isSaving ||
                    !addQuantityValue ||
                    Number(addQuantityValue) <= 0
                  }
                >
                  {isSaving ? "جاري الإضافة..." : "إضافة"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer to products Modal */}
      {showTransferModal && productToTransfer && (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            setShowTransferModal(false);
            setProductToTransfer(null);
            setTransferQuantity("");
          }}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3>
                  نقل من المخزن إلى المنتجات - {productToTransfer.name}
                </h3>
                <button
                  onClick={() => {
                    setShowTransferModal(false);
                    setProductToTransfer(null);
                    setTransferQuantity("");
                  }}
                  className={styles.closeBtn}
                >
                  ✖
                </button>
              </div>

              <div className={styles.modalSection}>
                <p style={{ marginBottom: "15px", color: "#666" }}>
                  الكمية الحالية في المخزن:{" "}
                  <strong>{computeProductQuantity(productToTransfer)}</strong>
                </p>
                <div className="inputContainer">
                  <label>
                    <FiCornerDownRight />
                  </label>
                  <input
                    type="number"
                    placeholder="أدخل الكمية المراد نقلها"
                    value={transferQuantity}
                    onChange={(e) => setTransferQuantity(e.target.value)}
                    min="1"
                    autoFocus
                  />
                </div>
                <p style={{ marginTop: 8, fontSize: 12, color: "#999" }}>
                  سيتم إنشاء منتج جديد في صفحة المنتجات بكود جديد ومتسلسل.
                </p>
              </div>

              <div
                style={{
                  marginTop: "12px",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "8px",
                }}
              >
                <button
                  onClick={() => {
                    setShowTransferModal(false);
                    setProductToTransfer(null);
                    setTransferQuantity("");
                  }}
                  className={styles.btnOutline}
                  disabled={isSaving}
                >
                  إلغاء
                </button>
                <button
                  onClick={handleConfirmTransfer}
                  className={styles.btnPrimary}
                  disabled={
                    isSaving ||
                    !transferQuantity ||
                    Number(transferQuantity) <= 0
                  }
                >
                  {isSaving ? "جاري النقل..." : "نقل"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stock() {
  return (
    <NotificationProvider>
      <StockContent />
    </NotificationProvider>
  );
}

export default Stock;


