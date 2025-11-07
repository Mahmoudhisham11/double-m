'use client';
import SideBar from "../SideBar/page";
import styles from "./styles.module.css";
import { useState, useEffect, useRef } from "react";
import { IoMdSearch } from "react-icons/io";
import { FaRegTrashAlt } from "react-icons/fa";
import { IoIosCloseCircle } from "react-icons/io";
import { FaUser } from "react-icons/fa";
import { FaPhone } from "react-icons/fa";
import { FaBars } from "react-icons/fa6";
import {
  collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, getDocs, getDoc, writeBatch
} from "firebase/firestore";
import { db } from "@/app/firebase";
import { useRouter } from "next/navigation";

function Main() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [employess, setEmployess] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [savePage, setSavePage] = useState(false);
  const [openSideBar, setOpenSideBar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [customPrices, setCustomPrices] = useState({});
  const [searchCode, setSearchCode] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [dailySales, setDailySales] = useState([]);
  const [showClientPopup, setShowClientPopup] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [searchClient, setSearchClient] = useState("");

  // NEW: discount popup & values
  const [showDiscountPopup, setShowDiscountPopup] = useState(false);
  const [discountInput, setDiscountInput] = useState(0);
  const [discountNotes, setDiscountNotes] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(0);

  // NEW: variant selection popup states
  const [showVariantPopup, setShowVariantPopup] = useState(false);
  const [variantProduct, setVariantProduct] = useState(null); // lacosteProducts doc (with id)
  const [variantSelectedColor, setVariantSelectedColor] = useState("");
  const [variantSelectedSize, setVariantSelectedSize] = useState("");
  const [variantQuantity, setVariantQuantity] = useState(1);

  const nameRef = useRef();
  const phoneRef = useRef();
  const shop = typeof window !== "undefined" ? localStorage.getItem("shop") : "";

  useEffect(() => {
    if (!shop) return;
    const q = query(collection(db, "dailySales"), where("shop", "==", shop));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setDailySales(data);
    });
    return () => unsubscribe();
  }, [shop]);

  // products are lacosteProducts collection (as you said products stored there)
  useEffect(() => {
    if (!shop) return;
    const q = query(collection(db, "lacosteProducts"), where("shop", "==", shop));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setProducts(data);
    });
    return () => unsubscribe();
  }, [shop]);

  useEffect(() => {
    if (!shop) return;
    const q = query(collection(db, "cart"), where("shop", "==", shop));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setCart(data);
    });
    return () => unsubscribe();
  }, [shop]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storageUserName = localStorage.getItem("userName");
      if (!storageUserName) return;
      const q = query(collection(db, 'users'), where('userName', '==', storageUserName));
      const unsubscribe = onSnapshot(q, (snapShot) => {
        if (snapShot.empty) return;
        const data = snapShot.docs[0].data();
        if (data.isSubscribed === false) {
          alert('لقد تم اغلاق الحساب برجاء التواصل مع المطور');
          localStorage.clear();
          window.location.reload();
        }
      });
      return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    if (!shop) return;
    const q = query(collection(db, 'employees'), where('shop', '==', shop));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setEmployess(data);
    });
    return () => unsubscribe();
  }, [shop]);

  // -------------------------
  // helpers: compute sums and safe update logic
  // -------------------------
  const sumColorsQty = (colors = []) => colors.reduce((s, c) => s + (Number(c.quantity || 0)), 0);
  const sumSizesQty = (sizes = []) => sizes.reduce((s, c) => s + (Number(c.quantity || 0)), 0);

  // recompute product.quantity after updating colors/sizes
  const computeNewTotalQuantity = (colors, sizes, fallbackOldQuantity = 0) => {
    const cSum = Array.isArray(colors) ? sumColorsQty(colors) : 0;
    const sSum = Array.isArray(sizes) ? sumSizesQty(sizes) : 0;
    if (cSum > 0 && sSum > 0) {
      // prefer the larger sum to avoid accidentally deleting stock
      return Math.max(cSum, sSum);
    }
    if (cSum > 0) return cSum;
    if (sSum > 0) return sSum;
    return fallbackOldQuantity;
  };

  // -------------------------
  // handleAddToCart: now opens variant popup if product has colors/sizes
  // -------------------------
  const openVariantForProduct = (product) => {
    // product is lacosteProducts doc with id
    setVariantProduct(product);
    // default selections
    setVariantSelectedColor(product.colors && product.colors.length ? product.colors[0].color : "");
    setVariantSelectedSize(product.sizes && product.sizes.length ? product.sizes[0].size : "");
    setVariantQuantity(1);
    setShowVariantPopup(true);
  };

  const addToCartAndReserve = async (product, options = {}) => {
    // options: { color, size, quantity }
    const qty = Number(options.quantity || 1);
    // calculate available based on variant(s)
    let available = product.quantity || 0;
    if (options.color && product.colors && product.colors.length) {
      const c = product.colors.find(x => x.color === (options.color || ""));
      available = c ? Number(c.quantity || 0) : 0;
    }
    if (options.size && product.sizes && product.sizes.length) {
      const s = product.sizes.find(x => x.size === (options.size || ""));
      // If both color and size provided, ensure both have enough — available becomes min of both
      if (options.color && product.colors && product.colors.length) {
        const c = product.colors.find(x => x.color === (options.color || ""));
        const cQty = c ? Number(c.quantity || 0) : 0;
        const sQty = s ? Number(s.quantity || 0) : 0;
        available = Math.min(cQty, sQty);
      } else {
        available = s ? Number(s.quantity || 0) : 0;
      }
    }

    if (qty < 1) {
      alert("الكمية يجب أن تكون على الأقل 1");
      return;
    }

    if (qty > available) {
      alert(`الكمية المطلوبة (${qty}) أكبر من الكمية المتاحة (${available})`);
      return;
    }

    // prepare cart data (include variant info and originalProductId)
    let cartData = {
      name: product.name,
      sellPrice: Number(customPrices[product.id]) || product.sellPrice,
      productPrice: product.sellPrice,
      quantity: qty,
      type: product.type,
      total: (Number(customPrices[product.id]) || product.sellPrice) * qty,
      date: new Date(),
      shop: shop,
      color: options.color || "",
      size: options.size || "",
      originalProductId: product.id,
      code: product.code || "",
      buyPrice: product.buyPrice || 0,
    };

    // add to cart collection
    await addDoc(collection(db, "cart"), cartData);

    // reserve/decrement the lacosteProducts quantities immediately
    try {
      const prodRef = doc(db, "lacosteProducts", product.id);
      const prodSnap = await getDoc(prodRef);
      if (prodSnap.exists()) {
        const prodData = prodSnap.data();

        // We'll prepare updated arrays for both colors and sizes if needed
        let newColors = Array.isArray(prodData.colors) ? [...prodData.colors] : null;
        let newSizes = Array.isArray(prodData.sizes) ? [...prodData.sizes] : null;

        // If color option provided -> decrement that color
        if (options.color && newColors) {
          newColors = newColors.map(c => {
            if (c.color === options.color) {
              return { ...c, quantity: Math.max(0, (Number(c.quantity || 0) - qty)) };
            }
            return c;
          }).filter(c => Number(c.quantity || 0) > 0); // optionally remove zero entries
        }

        // If size option provided -> decrement that size
        if (options.size && newSizes) {
          newSizes = newSizes.map(s => {
            if (s.size === options.size) {
              return { ...s, quantity: Math.max(0, (Number(s.quantity || 0) - qty)) };
            }
            return s;
          }).filter(s => Number(s.quantity || 0) > 0);
        }

        // If product has BOTH arrays and we changed both, compute new total accordingly
        const newTotalQty = computeNewTotalQuantity(newColors, newSizes, Number(prodData.quantity || 0));

        if (newTotalQty <= 0) {
          // delete product doc if no more stock
          await deleteDoc(prodRef);
        } else {
          const updateObj = { quantity: newTotalQty };
          if (newColors) updateObj.colors = newColors;
          if (newSizes) updateObj.sizes = newSizes;
          await updateDoc(prodRef, updateObj);
        }
      }
    } catch (err) {
      console.error("خطأ أثناء حجز المنتج في المخزون:", err);
      alert("حدث خطأ أثناء حجز المنتج من المخزون");
    }

    // clear custom price for product
    setCustomPrices(prev => {
      const updated = { ...prev };
      delete updated[product.id];
      return updated;
    });
  };

  // original handleAddToCart replaced by openVariant logic:
  const handleAddToCart = async (product) => {
    // if product has colors or sizes -> open variant popup
    if ((product.colors && product.colors.length > 0) || (product.sizes && product.sizes.length > 0)) {
      openVariantForProduct(product);
    } else {
      // no variants -> add normally with quantity 1 and decrement total quantity field
      await addToCartAndReserve(product, { quantity: 1 });
      setSearchCode("");
    }
  };

  // -------------------------
  // quantity change and delete on cart
  // -------------------------
  const handleQtyChange = async (cartItem, delta) => {
    const newQty = cartItem.quantity + delta;
    if (newQty < 1) return;

    // Note: since we reserve on add, we must check availability in DB before increasing qty
    // Find the lacosteProducts doc
    if (cartItem.originalProductId) {
      const prodRef = doc(db, "lacosteProducts", cartItem.originalProductId);
      const prodSnap = await getDoc(prodRef);
      if (prodSnap.exists()) {
        const prodData = prodSnap.data();
        // compute available for this variant
        let availableColor = null;
        let availableSize = null;
        if (cartItem.color && prodData.colors && prodData.colors.length) {
          const c = prodData.colors.find(x => x.color === cartItem.color);
          availableColor = c ? Number(c.quantity || 0) : 0;
        }
        if (cartItem.size && prodData.sizes && prodData.sizes.length) {
          const s = prodData.sizes.find(x => x.size === cartItem.size);
          availableSize = s ? Number(s.quantity || 0) : 0;
        }

        // If both variants present, need both to have enough (we reserved earlier)
        const need = newQty - cartItem.quantity;
        if (cartItem.color && cartItem.size) {
          const canIncrease = (availableColor >= need) && (availableSize >= need);
          if (!canIncrease) {
            alert("لا توجد كمية كافية لزيادة العدد (اللون أو المقاس غير كافيين)");
            return;
          }
        } else if (cartItem.color) {
          if (need > (availableColor || 0)) {
            alert("لا توجد كمية كافية لزيادة العدد (اللون غير كافٍ)");
            return;
          }
        } else if (cartItem.size) {
          if (need > (availableSize || 0)) {
            alert("لا توجد كمية كافية لزيادة العدد (المقاس غير كافٍ)");
            return;
          }
        } else {
          // fallback to total quantity field if no variants
          const avail = Number(prodData.quantity || 0);
          if (need > avail) {
            alert("لا توجد كمية كافية لزيادة العدد");
            return;
          }
        }

        // update cart
        const newTotal = newQty * cartItem.sellPrice;
        await updateDoc(doc(db, "cart", cartItem.id), {
          quantity: newQty,
          total: newTotal,
        });

        // decrement product reserve accordingly
        let newColors = Array.isArray(prodData.colors) ? [...prodData.colors] : null;
        let newSizes = Array.isArray(prodData.sizes) ? [...prodData.sizes] : null;

        if (cartItem.color && newColors) {
          newColors = newColors.map(c => {
            if (c.color === cartItem.color) {
              return { ...c, quantity: Math.max(0, (Number(c.quantity || 0) - need)) };
            }
            return c;
          }).filter(c => Number(c.quantity || 0) > 0);
        }
        if (cartItem.size && newSizes) {
          newSizes = newSizes.map(s => {
            if (s.size === cartItem.size) {
              return { ...s, quantity: Math.max(0, (Number(s.quantity || 0) - need)) };
            }
            return s;
          }).filter(s => Number(s.quantity || 0) > 0);
        }

        const newTotalQty = computeNewTotalQuantity(newColors, newSizes, Number(prodData.quantity || 0));
        if (newTotalQty <= 0) {
          await deleteDoc(prodRef);
        } else {
          const updateObj = { quantity: newTotalQty };
          if (newColors) updateObj.colors = newColors;
          if (newSizes) updateObj.sizes = newSizes;
          await updateDoc(prodRef, updateObj);
        }
      } else {
        alert("لم يتم العثور على بيانات المنتج في المخزون لعملية الزيادة");
      }
    } else {
      // no originalProductId -> just update cart
      const newTotal = newQty * cartItem.sellPrice;
      await updateDoc(doc(db, "cart", cartItem.id), {
        quantity: newQty,
        total: newTotal,
      });
    }
  };

  const handleDeleteCartItem = async (cartDocId) => {
    // when removing from cart before saving, we should restore reserved quantity back to lacosteProducts
    try {
      const cartRef = doc(db, "cart", cartDocId);
      const cartSnap = await getDoc(cartRef);
      if (cartSnap.exists()) {
        const cartData = cartSnap.data();
        if (cartData.originalProductId) {
          const prodRef = doc(db, "lacosteProducts", cartData.originalProductId);
          const prodSnap = await getDoc(prodRef);
          if (prodSnap.exists()) {
            const prodData = prodSnap.data();
            // restore variant(s)
            let newColors = Array.isArray(prodData.colors) ? [...prodData.colors] : null;
            let newSizes = Array.isArray(prodData.sizes) ? [...prodData.sizes] : null;

            if (cartData.color) {
              const found = newColors && newColors.find(c => c.color === cartData.color);
              if (found) {
                newColors = newColors.map(c => c.color === cartData.color ? { ...c, quantity: Number(c.quantity || 0) + Number(cartData.quantity || 0) } : c);
              } else {
                newColors = [...(newColors || []), { color: cartData.color, quantity: Number(cartData.quantity || 0) }];
              }
            }

            if (cartData.size) {
              const foundS = newSizes && newSizes.find(s => s.size === cartData.size);
              if (foundS) {
                newSizes = newSizes.map(s => s.size === cartData.size ? { ...s, quantity: Number(s.quantity || 0) + Number(cartData.quantity || 0) } : s);
              } else {
                newSizes = [...(newSizes || []), { size: cartData.size, quantity: Number(cartData.quantity || 0) }];
              }
            }

            // fallback to quantity field if neither variant exists
            const newTotalQty = computeNewTotalQuantity(newColors, newSizes, Number(prodData.quantity || 0));
            const updateObj = { quantity: newTotalQty };
            if (newColors) updateObj.colors = newColors;
            if (newSizes) updateObj.sizes = newSizes;
            await updateDoc(prodRef, updateObj);
          } else {
            // product doc disappeared, recreate with the returned variant
            const toAdd = {
              name: cartData.name,
              code: cartData.code || "",
              quantity: cartData.quantity || 0,
              buyPrice: cartData.buyPrice || 0,
              sellPrice: cartData.sellPrice || 0,
              shop: cartData.shop || shop,
              type: cartData.type || "product",
            };
            if (cartData.color) toAdd.colors = [{ color: cartData.color, quantity: cartData.quantity || 0 }];
            if (cartData.size) toAdd.sizes = [{ size: cartData.size, quantity: cartData.quantity || 0 }];
            await addDoc(collection(db, "lacosteProducts"), toAdd);
          }
        }
      }
    } catch (err) {
      console.error("خطأ أثناء استرجاع الكمية عند حذف العنصر من السلة:", err);
    }

    // finally delete the cart doc
    await deleteDoc(doc(db, "cart", cartDocId));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.sellPrice * (item.quantity || 1)), 0);
  const profit = cart.reduce((acc, item) => {
    const buy = Number(item.buyPrice || 0);
    const sell = Number(item.sellPrice || 0);
    const qty = Number(item.quantity || 1);
    return acc + ((sell - buy) * qty);
  }, 0);
  const finalTotal = Math.max(0, subtotal - appliedDiscount);

  const filteredProducts = products.filter((p) => {
    const search = searchCode.trim().toLowerCase();
    const matchName = search === "" || (p.code && p.code.toString().toLowerCase().includes(search));
    const matchType =
      filterType === "all"
        ? true
        : filterType === "phone"
          ? p.type === "phone"
          : p.type !== "phone";
    return matchName && matchType;
  });

  const phonesCount = products.filter(p => p.type === "phone").length;
  const otherCount = products.filter(p => p.type !== "phone").length;

  // when typing code: if product has variants -> open variant popup else add direct
  useEffect(() => {
  if (!searchCode || !shop) return;

  const timer = setTimeout(async () => {
    const foundProduct = products.find(p => p.code?.toString() === searchCode.trim());
    if (foundProduct) {
      if ((foundProduct.colors && foundProduct.colors.length > 0) || (foundProduct.sizes && foundProduct.sizes.length > 0)) {
        openVariantForProduct(foundProduct);
      } else {
        await addToCartAndReserve(foundProduct, { quantity: 1 });
      }

      setSearchCode("");
    }
  }, 400);

  return () => clearTimeout(timer);
}, [searchCode, products, cart, shop]);


  const handleApplyDiscount = () => {
    const numeric = Number(discountInput) || 0;
    if (numeric < 0) {
      alert('الخصم لا يمكن أن يكون قيمة سالبة');
      return;
    }
    if (numeric > subtotal) {
      const ok = window.confirm('الخصم أكبر من إجمالي الفاتورة، هل تريد تطبيقه؟');
      if (!ok) return;
    }
    setAppliedDiscount(Math.min(numeric, subtotal));
    setShowDiscountPopup(false);
  };

  const handleClearDiscount = () => {
    setAppliedDiscount(0);
    setDiscountInput(0);
    setDiscountNotes("");
  };

  const totalAmount = subtotal;

  // -------------------------
  // handleSaveReport: now we trust that stock was decremented when adding; still we verify availability as safety
  // -------------------------
  const handleSaveReport = async () => {
  if (isSaving) return;
  setIsSaving(true);

  const clientName = nameRef.current?.value || "";
  const phone = phoneRef.current?.value || "";

  if (cart.length === 0) {
    alert("يرجى إضافة منتجات إلى السلة قبل الحفظ");
    setIsSaving(false);
    return;
  }

  try {
    // تحقق من توفر المنتجات قبل الحفظ
    for (const item of cart) {
      if (item.originalProductId) {
        const prodRef = doc(db, "lacosteProducts", item.originalProductId);
        const prodSnap = await getDoc(prodRef);
        if (prodSnap.exists()) {
          const prodData = prodSnap.data();
          if (item.color && prodData.colors && prodData.colors.length) {
            const c = prodData.colors.find(x => x.color === item.color);
            if (!c) {
              console.warn(`تحذير: اللون ${item.color} غير موجود حالياً في المنتج ${item.name}`);
            }
          } else if (item.size && prodData.sizes && prodData.sizes.length) {
            const s = prodData.sizes.find(x => x.size === item.size);
            if (!s) {
              console.warn(`تحذير: المقاس ${item.size} غير موجود حالياً في المنتج ${item.name}`);
            }
          }
        } else {
          console.warn("منتج غير موجود في lacosteProducts أثناء الحفظ (قد تكون كمياته 0 وتم حذفه سابقاً).");
        }
      } else {
        const q = query(collection(db, "lacosteProducts"), where("code", "==", item.code), where("shop", "==", shop));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          console.warn("منتج غير موجود في lacosteProducts أثناء الحفظ (بحث بالكود).");
        }
      }
    }

    // 🧮 الحسابات المالية
    const computedSubtotal = cart.reduce((sum, item) => sum + (item.sellPrice * item.quantity), 0);
    const computedFinalTotal = Math.max(0, computedSubtotal - appliedDiscount);

    // نسبة الخصم من الإجمالي
    const discountRatio = computedSubtotal > 0 ? appliedDiscount / computedSubtotal : 0;

    // ✅ حساب الربح الحقيقي بعد الخصم
    const computedProfit = cart.reduce((sum, item) => {
      const itemSellTotal = item.sellPrice * item.quantity;
      const itemDiscount = itemSellTotal * discountRatio; // نصيب المنتج من الخصم
      const itemNetSell = itemSellTotal - itemDiscount;
      const itemBuyTotal = (item.buyPrice || 0) * item.quantity;
      const itemProfit = itemNetSell - itemBuyTotal;
      return sum + itemProfit;
    }, 0);

    const saleData = {
      cart,
      clientName,
      phone,
      subtotal: computedSubtotal,
      discount: appliedDiscount,
      discountNotes: discountNotes,
      total: computedFinalTotal,
      profit: computedProfit,
      date: new Date(),
      shop,
      employee: selectedEmployee || "غير محدد",
    };

    // 🧾 حفظ البيانات في المجموعتين
    await addDoc(collection(db, "dailySales"), saleData);
    await addDoc(collection(db, "employeesReports"), saleData);

    // 🗂️ حفظ آخر فاتورة محليًا
    if (typeof window !== "undefined") {
      localStorage.setItem("lastInvoice", JSON.stringify({
        cart,
        clientName,
        phone,
        subtotal: computedSubtotal,
        discount: appliedDiscount,
        discountNotes: discountNotes,
        total: computedFinalTotal,
        profit: computedProfit,
        length: cart.length,
        date: new Date(),
      }));
    }

    // 🧹 مسح السلة بعد الحفظ
    const qCart = query(collection(db, "cart"), where('shop', '==', shop));
    const cartSnapshot = await getDocs(qCart);
    for (const docSnap of cartSnapshot.docs) {
      await deleteDoc(docSnap.ref);
    }

    alert("تم حفظ التقرير بنجاح");

    // 🔄 إعادة ضبط الخصم
    setAppliedDiscount(0);
    setDiscountInput(0);
    setDiscountNotes("");

  } catch (error) {
    console.error("حدث خطأ أثناء حفظ التقرير:", error);
    alert("حدث خطأ أثناء حفظ التقرير");
  }

  setIsSaving(false);
  setSavePage(false);
  setShowClientPopup(false);
  router.push('/resete');
};


  const handleCloseDay = async () => {
    try {
      const q = query(collection(db, "dailySales"), where("shop", "==", shop));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        alert("لا يوجد عمليات لتقفيلها اليوم");
        return;
      }

      // استخدم Batch لتجميع العمليات لتحسين الأداء
      const batch = writeBatch(db);

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();

        // أضف الوثيقة إلى مجموعة التقارير (reports) باستخدام Batch
        const reportRef = doc(collection(db, "reports"));
        batch.set(reportRef, data);

        // احذف مستند dailySales الأصلي من خلال Batch
        batch.delete(docSnap.ref);
      }

      // نفذ كل العمليات دفعة واحدة
      await batch.commit();

      alert("تم تقفيل اليوم بنجاح ✅");
    } catch (error) {
      console.error("خطأ أثناء تقفيل اليوم:", error);
      alert("حدث خطأ أثناء تقفيل اليوم");
    }
  };

  const handleDeleteInvoice = async () => {
    if (!shop) return;
    const confirmDelete = window.confirm("هل أنت متأكد أنك تريد حذف الفاتورة بالكامل؟");
    if (!confirmDelete) return;
    try {
      const q = query(collection(db, "cart"), where("shop", "==", shop));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        alert("لا توجد منتجات في الفاتورة لحذفها.");
        return;
      }
      for (const docSnap of snapshot.docs) {
        // when deleting invoice (clearing cart) we should restore reserves to products
        await handleDeleteCartItem(docSnap.id);
      }
      handleClearDiscount();
      alert("تم حذف الفاتورة بالكامل بنجاح ✅");
    } catch (error) {
      console.error("حدث خطأ أثناء حذف الفاتورة:", error);
      alert("حدث خطأ أثناء حذف الفاتورة ❌");
    }
  };

  const formatDate = (date) => {
    if (!date) return "";
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" });
  };

  const filteredInvoices = dailySales.filter(inv =>
    inv.clientName?.toLowerCase().includes(searchClient.toLowerCase())
  );

  const totalSales = filteredInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
  const employeeSales = {};
  filteredInvoices.forEach((invoice) => {
    if (invoice.employee && invoice.employee !== "غير محدد") {
      employeeSales[invoice.employee] = (employeeSales[invoice.employee] || 0) + invoice.total;
    }
  });
  const topEmployee =
    Object.entries(employeeSales).sort((a, b) => b[1] - a[1])[0]?.[0] || "لا يوجد موظفين";

  // return product (refund) -> restore color/size quantities to lacosteProducts
  const handleReturnProduct = async (item, invoiceId) => {
  try {
    // البحث عن المنتج وتحديثه أو إنشاؤه
    let prodRef = null;
    if (item.originalProductId) {
      prodRef = doc(db, "lacosteProducts", item.originalProductId);
    } else {
      const q = query(collection(db, "lacosteProducts"), where("code", "==", item.code), where("shop", "==", item.shop));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) prodRef = snapshot.docs[0].ref;
    }

    if (prodRef) {
      const prodSnap = await getDoc(prodRef);
      if (prodSnap.exists()) {
        const prodData = prodSnap.data();

        let newColors = Array.isArray(prodData.colors) ? [...prodData.colors] : null;
        let newSizes = Array.isArray(prodData.sizes) ? [...prodData.sizes] : null;

        // restore color
        if (item.color) {
          if (newColors) {
            const found = newColors.find(c => c.color === item.color);
            if (found) {
              newColors = newColors.map(c => c.color === item.color ? { ...c, quantity: Number(c.quantity || 0) + Number(item.quantity || 0) } : c);
            } else {
              newColors = [...(newColors || []), { color: item.color, quantity: Number(item.quantity || 0) }];
            }
          } else {
            newColors = [{ color: item.color, quantity: Number(item.quantity || 0) }];
          }
        }

        // restore size
        if (item.size) {
          if (newSizes) {
            const foundS = newSizes.find(s => s.size === item.size);
            if (foundS) {
              newSizes = newSizes.map(s => s.size === item.size ? { ...s, quantity: Number(s.quantity || 0) + Number(item.quantity || 0) } : s);
            } else {
              newSizes = [...(newSizes || []), { size: item.size, quantity: Number(item.quantity || 0) }];
            }
          } else {
            newSizes = [{ size: item.size, quantity: Number(item.quantity || 0) }];
          }
        }

        const newTotalQty = computeNewTotalQuantity(newColors, newSizes, Number(prodData.quantity || 0));
        const updateObj = { quantity: newTotalQty };
        if (newColors) updateObj.colors = newColors;
        if (newSizes) updateObj.sizes = newSizes;
        await updateDoc(prodRef, updateObj);
      } else {
        // المنتج مش موجود - نضيفه جديد
        const toAdd = {
          name: item.name,
          code: item.code || "",
          quantity: item.quantity || 0,
          buyPrice: item.buyPrice || 0,
          sellPrice: item.sellPrice || 0,
          shop: item.shop || shop,
          type: item.type || "product",
        };
        if (item.color) toAdd.colors = [{ color: item.color, quantity: item.quantity || 0 }];
        if (item.size) toAdd.sizes = [{ size: item.size, quantity: item.quantity || 0 }];
        await addDoc(collection(db, "lacosteProducts"), toAdd);
      }
    } else {
      // المنتج مش موجود خالص - نضيفه
      const toAdd = {
        name: item.name,
        code: item.code || "",
        quantity: item.quantity || 0,
        buyPrice: item.buyPrice || 0,
        sellPrice: item.sellPrice || 0,
        shop: item.shop || shop,
        type: item.type || "product",
      };
      if (item.color) toAdd.colors = [{ color: item.color, quantity: item.quantity || 0 }];
      if (item.size) toAdd.sizes = [{ size: item.size, quantity: item.quantity || 0 }];
      await addDoc(collection(db, "lacosteProducts"), toAdd);
    }

    // تحديث الفاتورة في dailySales
    const invoiceRef = doc(db, "dailySales", invoiceId);
    const invoiceSnap = await getDoc(invoiceRef);

    if (invoiceSnap.exists()) {
      const invoiceData = invoiceSnap.data();
      const updatedCart = invoiceData.cart.filter(
        (p) =>
          !(
            p.code === item.code &&
            p.quantity === item.quantity &&
            p.sellPrice === item.sellPrice &&
            p.name === item.name &&
            (p.color || "") === (item.color || "") &&
            (p.size || "") === (item.size || "")
          )
      );

      if (updatedCart.length > 0) {
        const newTotal = updatedCart.reduce((sum, p) => sum + (p.sellPrice * p.quantity || 0), 0);
        const newProfit = updatedCart.reduce((sum, p) => sum + ((p.sellPrice - (p.buyPrice || 0)) * (p.quantity || 1)), 0);

        await updateDoc(invoiceRef, { cart: updatedCart, total: newTotal, profit: newProfit });

        // 🔹 تحديث نفس الفاتورة في employeesReports
        const empQ = query(collection(db, "employeesReports"), where("date", "==", invoiceData.date), where("shop", "==", invoiceData.shop));
        const empSnap = await getDocs(empQ);
        empSnap.forEach(async (d) => {
          await updateDoc(d.ref, { cart: updatedCart, total: newTotal, profit: newProfit });
        });

        alert(`✅ تم إرجاع ${item.name} بنجاح وحُذف من الفاتورة!`);
      } else {
        await deleteDoc(invoiceRef);

        // 🔹 حذف نفس الفاتورة من employeesReports
        const empQ = query(collection(db, "employeesReports"), where("date", "==", invoiceData.date), where("shop", "==", invoiceData.shop));
        const empSnap = await getDocs(empQ);
        empSnap.forEach(async (d) => {
          await deleteDoc(d.ref);
        });

        alert(`✅ تم إرجاع ${item.name} وحُذفت الفاتورة لأنها أصبحت فارغة.`);
      }
    } else {
      alert("⚠️ لم يتم العثور على الفاتورة!");
    }

  } catch (error) {
    console.error("خطأ أثناء الإرجاع:", error);
    alert("❌ حدث خطأ أثناء إرجاع المنتج");
  }
};


  return (
    <div className={styles.mainContainer}>
      <SideBar openSideBar={openSideBar} setOpenSideBar={setOpenSideBar} />

      <div className={styles.middleSection}>
        <div className={styles.title}>
          <div className={styles.rightSide}>
            <button onClick={() => setOpenSideBar(true)}><FaBars /></button>
            <h3>المبيعات اليومية</h3>
          </div>
            <div className={styles.searchBox}>
            <IoMdSearch />
            <input
              type="text"
              placeholder="ابحث باسم العميل..."
              value={searchClient}
              onChange={(e) => setSearchClient(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.salesContainer}>
          {/* ✅ كروت احصائية */}
          <div className={styles.cardsContainer}>
            <div className={styles.card}>
              <h4>عدد الفواتير</h4>
              <p>{filteredInvoices.length}</p>
            </div>
            <div className={styles.card}>
              <h4>إجمالي المبيعات</h4>
              <p>{totalSales} جنيه</p>
            </div>
            <div className={styles.card}>
              <h4>أنشط موظف</h4>
              <p>{topEmployee}</p>
            </div>
          </div>
          
          {filteredInvoices.length === 0 ? (
            <p>لا توجد عمليات بعد اليوم</p>
          ) : (
            <div className={styles.tableContainer}>
              <table>
              <thead>
                <tr>
                  <th>العميل</th>
                  <th>رقم الهاتف</th>
                  <th>الموظف</th>
                  <th>الإجمالي</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    onClick={() => setSelectedInvoice(invoice)}
                    className={styles.tableRow}
                  >
                    <td>{invoice.clientName || "بدون اسم"}</td>
                    <td>{invoice.phone || "-"}</td>
                    <td>{invoice.employee || "غير محدد"}</td>
                    <td>{invoice.total} جنيه</td>
                    <td>{formatDate(invoice.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}

          {selectedInvoice && (
          <div className={styles.invoiceSidebar}>
            <div className={styles.sidebarHeader}>
              <h4>فاتورة العميل</h4>
              <button onClick={() => setSelectedInvoice(null)}>
                <IoIosCloseCircle size={22} />
              </button>
            </div>

            <div className={styles.sidebarInfo}>
              <p><strong>👤 العميل:</strong> {selectedInvoice.clientName || "بدون اسم"}</p>
              <p><strong>📞 الهاتف:</strong> {selectedInvoice.phone || "-"}</p>
              <p><strong>💼 الموظف:</strong> {selectedInvoice.employee || "غير محدد"}</p>
              <p><strong>🕒 التاريخ:</strong> {formatDate(selectedInvoice.date)}</p>

              {/* ✅ الخصم، ملاحظات الخصم، الربح قبل الإجمالي */}
              {selectedInvoice.profit !== undefined && (
                <p><strong>📈 ربح الفاتورة:</strong> {selectedInvoice.profit} جنيه</p>
              )}
              {selectedInvoice.discount > 0 && (
                <p>
                  <strong>🔖 الخصم:</strong> {selectedInvoice.discount} جنيه
                  {selectedInvoice.discountNotes ? ` (ملاحظة: ${selectedInvoice.discountNotes})` : ""}
                </p>
              )}
              <p><strong>💰 الإجمالي:</strong> {selectedInvoice.total} جنيه</p>
            </div>

            <div className={styles.sidebarProducts}>
              <h5>المنتجات</h5>
              <table>
                <thead>
                  <tr>
                    <th>المنتج</th>
                    <th>السعر</th>
                    <th>الكمية</th>
                    <th>السريال</th>
                    <th>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.cart.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.name} {item.color ? ` - ${item.color}` : ""} {item.size ? ` - ${item.size}` : ""}</td>
                      <td>{item.sellPrice}</td>
                      <td>{item.quantity}</td>
                      <td>{item.serial || "-"}</td>
                      <td>
                        <button
                          className={styles.returnBtn}
                          onClick={() => handleReturnProduct(item, selectedInvoice.id)}
                        >
                          مرتجع
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}


        </div>

      </div>

      {/* باقي الكود كما هو بدون حذف */}
      <div className={styles.resetContainer}>
        <div className={styles.reset}>
          <div className={styles.topReset}>
            <div className={styles.resetTitle}>
              <h3>محتوى الفاتورة</h3>
              <button onClick={() => setShowClientPopup(true)}>اضف العميل</button>
            </div>
            <div className={styles.resetActions}>
              <div className={styles.inputBox}>
                <label><IoMdSearch /></label>
                <input
                  type="text"
                  list="codeList"
                  placeholder="ابحث بالكود"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                />
                <datalist id="codeList">
                  {products.map((p) => (
                    <option key={p.id} value={p.code} />
                  ))}
                </datalist>
              </div>
              <button onClick={() => setShowDiscountPopup(true)}>خصم</button>
              <button onClick={handleDeleteInvoice}>حذف الفاتورة</button>
            </div>
          </div>
          <hr />
          <div className={styles.orderBox}>
            {cart.map((item) => (
              <div className={styles.ordersContainer} key={item.id}>
                <div className={styles.orderInfo}>
                  <div className={styles.content}>
                    <button onClick={() => handleDeleteCartItem(item.id)}><FaRegTrashAlt /></button>
                    <div className={styles.text}>
                      <h4>{item.name} {item.color ? ` - ${item.color}` : ""} {item.size ? ` - ${item.size}` : ""}</h4>
                      <p>{item.total} EGP</p>
                    </div>
                  </div>
                  <div className={styles.qtyInput}>
                    <button onClick={() => handleQtyChange(item, -1)}>-</button>
                    <input type="text" value={item.quantity} readOnly />
                    <button onClick={() => handleQtyChange(item, 1)}>+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.totalContainer}>
            <hr />
            <div className={styles.totalBox}>
              <h3>الاجمالي</h3>

              {/* NEW: show profit and discount above total */}
              <div style={{ marginBottom: 8 }}>
                <div><strong>📈 ربح الفاتورة:</strong> {profit} جنيه</div>
                <div><strong>🔖 الخصم:</strong> {appliedDiscount} جنيه {appliedDiscount > 0 ? `(ملاحظة: ${discountNotes || '-'})` : null}</div>
              </div>

              <strong>{finalTotal} EGP</strong>
            </div>
            <div className={styles.resetBtns}>
              <button onClick={handleSaveReport}>حفظ</button>
              <button onClick={handleCloseDay}>
                تقفيل اليوم
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ popup لإضافة العميل */}
      {showClientPopup && (
        <div className={styles.popupOverlay}>
          <div className={styles.popupBox}>
            <h3>إضافة بيانات العميل</h3>
            <label>اسم العميل:</label>
            <input type="text" ref={nameRef} placeholder="اكتب اسم العميل" />
            <label>رقم الهاتف:</label>
            <input type="text" ref={phoneRef} placeholder="اكتب رقم الهاتف" />
            <label>اسم الموظف:</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
            >
              <option value="">اختر الموظف</option>
              {employess.map((emp) => (
                <option key={emp.id} value={emp.name}>
                  {emp.name}
                </option>
              ))}
            </select>

            <div className={styles.popupBtns}>
              <button onClick={handleSaveReport}>حفظ</button>
              <button onClick={() => setShowClientPopup(false)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* NEW: popup لتطبيق الخصم والملاحظات */}
      {showDiscountPopup && (
        <div className={styles.popupOverlay}>
          <div className={styles.popupBox}>
            <h3>تطبيق خصم على الفاتورة</h3>
            <label>قيمة الخصم (جنيه):</label>
            <input
              type="number"
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
              min={0}
              placeholder="ادخل قيمة الخصم"
            />
            <label>الملاحظات:</label>
            <input
              type="text"
              value={discountNotes}
              onChange={(e) => setDiscountNotes(e.target.value)}
              placeholder="اكتب ملاحظة للخصم (اختياري)"
            />
            <div className={styles.popupBtns}>
              <button onClick={handleApplyDiscount}>تطبيق</button>
              <button onClick={() => setShowDiscountPopup(false)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* NEW: Variant selection popup */}
      {showVariantPopup && variantProduct && (
        <div className={styles.popupOverlay}>
          <div className={styles.popupBox}>
            <h3>اختر اللون/المقاس — {variantProduct.name}</h3>

            {/* الألوان */}
            {variantProduct.colors && variantProduct.colors.length > 0 && (
              <>
                <label>الألوان المتاحة:</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  {variantProduct.colors.map((c, idx) => (
                    <button
                      key={idx}
                      onClick={() => setVariantSelectedColor(c.color)}
                      style={{
                        padding: '6px 10px',
                        border: variantSelectedColor === c.color ? '2px solid #333' : '1px solid #ccc',
                        borderRadius: 6,
                        background: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      {c.color} ({c.quantity})
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* المقاسات */}
            {variantProduct.sizes && variantProduct.sizes.length > 0 && (
              <>
                <label>المقاسات المتاحة:</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  {variantProduct.sizes.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => setVariantSelectedSize(s.size)}
                      style={{
                        padding: '6px 10px',
                        border: variantSelectedSize === s.size ? '2px solid #333' : '1px solid #ccc',
                        borderRadius: 6,
                        background: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      {s.size} ({s.quantity})
                    </button>
                  ))}
                </div>
              </>
            )}

            <label>الكمية:</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <button onClick={() => setVariantQuantity(q => Math.max(1, q - 1))}>-</button>
              <input type="number" value={variantQuantity} onChange={(e) => setVariantQuantity(Math.max(1, Number(e.target.value || 1)))} style={{ width: 60, textAlign: 'center' }} />
              <button onClick={() => setVariantQuantity(q => q + 1)}>+</button>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowVariantPopup(false); setVariantProduct(null); }}>إلغاء</button>
              <button onClick={async () => {
                // validation before add
                const selectedColor = variantSelectedColor;
                const selectedSize = variantSelectedSize;
                const qty = Number(variantQuantity || 1);

                // compute available
                let available = variantProduct.quantity || 0;
                if (selectedColor && variantProduct.colors && variantProduct.colors.length) {
                  const c = variantProduct.colors.find(x => x.color === selectedColor);
                  available = c ? Number(c.quantity || 0) : 0;
                }
                if (selectedSize && variantProduct.sizes && variantProduct.sizes.length) {
                  const s = variantProduct.sizes.find(x => x.size === selectedSize);
                  if (selectedColor && variantProduct.colors && variantProduct.colors.length) {
                    // both provided: availability is min of both
                    const c = variantProduct.colors.find(x => x.color === selectedColor);
                    const cQty = c ? Number(c.quantity || 0) : 0;
                    const sQty = s ? Number(s.quantity || 0) : 0;
                    available = Math.min(cQty, sQty);
                  } else {
                    available = s ? Number(s.quantity || 0) : 0;
                  }
                }

                if (qty > available) {
                  alert(`الكمية المطلوبة (${qty}) أكبر من المتاح (${available})`);
                  return;
                }

                await addToCartAndReserve(variantProduct, { color: selectedColor, size: selectedSize, quantity: qty });
                setShowVariantPopup(false);
                setVariantProduct(null);
              }}>أضف للسلة</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Main;