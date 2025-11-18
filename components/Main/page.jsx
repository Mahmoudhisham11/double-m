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
  collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, getDocs, getDoc, writeBatch,Timestamp,runTransaction 
} from "firebase/firestore";
import { db } from "@/app/firebase";
import { useRouter } from "next/navigation";

function Main() {
  const router = useRouter();
  const [isHidden, setIsHidden] = useState(true);
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
  const [masrofat, setMasrofat] = useState([])
  const [totalMaxDiscount, setTotalMaxDiscount] = useState(0)
  const [editPricePopup, setEditPricePopup] = useState(false);
const [productToEdit, setProductToEdit] = useState(null);
const [newPriceInput, setNewPriceInput] = useState(0);
const [tempPrices, setTempPrices] = useState({});
const [showPricePopup, setShowPricePopup] = useState(false);



  // NEW: discount popup & values
  const [showDiscountPopup, setShowDiscountPopup] = useState(false);
  const [discountInput, setDiscountInput] = useState(0);
  const [discountNotes, setDiscountNotes] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(0);

  // Variant modal states (updated to support color -> sizes -> qty per size)
  const [showVariantPopup, setShowVariantPopup] = useState(false);
  const [variantProduct, setVariantProduct] = useState(null); // lacosteProducts doc (with id)
  const [variantSelectedColor, setVariantSelectedColor] = useState("");
  // map size => qty for currently selected color in modal
  const [variantSizeMap, setVariantSizeMap] = useState({}); // { "M": 0, "L": 2 }

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
  
  useEffect(() => {
    if (!shop) return;
    const q = query(collection(db, "masrofat"), where("shop", "==", shop));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMasrofat(data);
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

  // دالة لتبديل حالة الإخفاء
  const toggleHidden = () => {
    setIsHidden(prev => {
      const newState = !prev;
      localStorage.setItem('hideFinance', newState);
      return newState;
    });
  };

  // -------------------------
  // helpers: compute sums and safe update logic
  // -------------------------
  const sumColorsQty = (colors = []) => {
    // support both old {color, quantity} and new {color, sizes: [{size, qty}]}
    return colors.reduce((s, c) => {
      if (Array.isArray(c.sizes)) return s + c.sizes.reduce((ss, it) => ss + Number(it.qty || it.quantity || 0), 0);
      return s + (Number(c.quantity || 0));
    }, 0);
  };
  const sumSizesQty = (sizes = []) => sizes.reduce((s, c) => s + (Number(c.qty || c.quantity || 0)), 0);

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

  // helper: get available quantity for given product + optional color + optional size
  const getAvailableForVariant = (product, colorName, sizeName) => {
    if (!product) return 0;
    // if color specified
    if (colorName) {
      const colorObj = Array.isArray(product.colors) ? product.colors.find(c => c.color === colorName) : null;
      if (colorObj) {
        // if color has sizes array
        if (Array.isArray(colorObj.sizes) && colorObj.sizes.length) {
          if (sizeName) {
            const sizeObj = colorObj.sizes.find(s => s.size === sizeName);
            return sizeObj ? Number(sizeObj.qty || sizeObj.quantity || 0) : 0;
          } else {
            // sum all sizes under color
            return colorObj.sizes.reduce((s, it) => s + Number(it.qty || it.quantity || 0), 0);
          }
        }
        // fallback to colorObj.quantity if present
        return Number(colorObj.quantity || 0);
      }
      return 0;
    }

    // if size specified at product root
    if (sizeName) {
      const sizeObj = Array.isArray(product.sizes) ? product.sizes.find(s => s.size === sizeName) : null;
      return sizeObj ? Number(sizeObj.qty || sizeObj.quantity || 0) : 0;
    }

    // fallback to total quantity
    return Number(product.quantity || 0);
  };

  // -------------------------
  // handleAddToCart: now opens variant popup if product has colors/sizes
  // -------------------------
  const openVariantForProduct = (product) => {
    // product is lacosteProducts doc with id
    setVariantProduct(product);
    // default color -> first available color
    const firstColor = (product.colors && product.colors.length) ? product.colors[0].color : "";
    setVariantSelectedColor(firstColor);

    // default variantSizeMap based on firstColor
    const initMap = {};
    if (product.colors && product.colors.length && firstColor) {
      const colorObj = product.colors.find(c => c.color === firstColor);
      if (colorObj && Array.isArray(colorObj.sizes)) {
        colorObj.sizes.forEach(sz => initMap[sz.size] = 0);
      }
    } else if (product.sizes && product.sizes.length) {
      product.sizes.forEach(sz => initMap[sz.size] = 0);
    }
    setVariantSizeMap(initMap);
    setShowVariantPopup(true);
  };

const addToCartAndReserve = async (product, options = {}) => {
  const hasColors = product.colors && product.colors.length > 0;
  const hasSizes = product.sizes && product.sizes.length > 0;

  // لو المنتج بسيط (مالوش ألوان أو مقاسات)
  if (!hasColors && !hasSizes) {
    // فتح popup السعر فقط
    setVariantProduct(product);          // نخزن المنتج
    setShowPricePopup(true);             // افتح popup السعر
    setNewPriceInput(product.sellPrice); // السعر الافتراضي يظهر
    return; // منع أي عملية أخرى للدالة
  }

  // المنتج ليه ألوان أو مقاسات → استمر في الإضافة للسلة كالمعتاد
  const qty = Number(options.quantity) || 1;
  if (qty <= 0) return;

  const available = getAvailableForVariant(product, options.color, options.size);
  if (qty > available) {
    alert(`الكمية المطلوبة (${qty}) أكبر من المتاح (${available})`);
    return;
  }

  const sellPrice = Number(options.price ?? product.sellPrice);
  const cartData = {
    name: product.name,
    sellPrice,
    productPrice: product.sellPrice,
    quantity: qty,
    type: product.type,
    total: sellPrice * qty,
    date: new Date(),
    shop: shop,
    color: options.color || "",
    size: options.size || "",
    originalProductId: product.id,
    code: product.code || "",
    buyPrice: product.buyPrice || 0,
  };

  // إضافة المنتج للسلة
  await addDoc(collection(db, "cart"), cartData);

  // باقي الكود الأصلي لتحديث المخزون...
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

        if (cartItem.color) {
          // available for color: sum of sizes under color OR legacy quantity
          const c = Array.isArray(prodData.colors) ? prodData.colors.find(x => x.color === cartItem.color) : null;
          if (c) {
            if (Array.isArray(c.sizes)) {
              availableColor = c.sizes.reduce((s, it) => s + Number(it.qty || it.quantity || 0), 0);
            } else {
              availableColor = Number(c.quantity || 0);
            }
          } else {
            availableColor = 0;
          }
        }
        if (cartItem.size) {
          // available size at product level or inside color
          const sInRoot = Array.isArray(prodData.sizes) ? prodData.sizes.find(x => x.size === cartItem.size) : null;
          availableSize = sInRoot ? Number(sInRoot.qty || sInRoot.quantity || 0) : null;
          if (cartItem.color && Array.isArray(prodData.colors)) {
            const c = prodData.colors.find(x => x.color === cartItem.color);
            if (c && Array.isArray(c.sizes)) {
              const s = c.sizes.find(x => x.size === cartItem.size);
              availableSize = s ? Number(s.qty || s.quantity || 0) : (availableSize ?? 0);
            }
          }
        }

        const need = newQty - cartItem.quantity;
        if (need > 0) {
          // increasing -> ensure availability
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

          // decrement product reserve accordingly (same logic as addToCartAndReserve)
          let newColors = Array.isArray(prodData.colors) ? prodData.colors.map(c => {
            return {
              color: c.color,
              sizes: Array.isArray(c.sizes) ? c.sizes.map(s => ({ size: s.size, qty: Number(s.qty ?? s.quantity ?? 0) })) : undefined,
              quantity: c.quantity !== undefined ? Number(c.quantity) : undefined
            };
          }) : null;
          let newSizes = Array.isArray(prodData.sizes) ? prodData.sizes.map(s => ({ size: s.size, qty: Number(s.qty ?? s.quantity ?? 0) })) : null;

          if (cartItem.color && cartItem.size && newColors) {
            newColors = newColors.map(c => {
              if (c.color === cartItem.color) {
                if (Array.isArray(c.sizes)) {
                  const sizesCopy = c.sizes.map(s => ({ ...s }));
                  const target = sizesCopy.find(s => s.size === cartItem.size);
                  if (target) target.qty = Math.max(0, Number(target.qty || 0) - need);
                  return { ...c, sizes: sizesCopy.filter(s => Number(s.qty || 0) > 0) };
                } else {
                  return { ...c, quantity: Math.max(0, Number(c.quantity || 0) - need) };
                }
              }
              return c;
            }).filter(c => (Array.isArray(c.sizes) ? c.sizes.length > 0 : Number(c.quantity || 0) > 0));
          } else if (cartItem.color && newColors) {
            newColors = newColors.map(c => {
              if (c.color === cartItem.color) {
                if (Array.isArray(c.sizes)) {
                  const sizesCopy = c.sizes.map(s => ({ ...s }));
                  let remain = need;
                  for (let i = 0; i < sizesCopy.length && remain > 0; i++) {
                    const take = Math.min(Number(sizesCopy[i].qty || 0), remain);
                    sizesCopy[i].qty = Math.max(0, Number(sizesCopy[i].qty || 0) - take);
                    remain -= take;
                  }
                  return { ...c, sizes: sizesCopy.filter(s => Number(s.qty || 0) > 0) };
                } else {
                  return { ...c, quantity: Math.max(0, Number(c.quantity || 0) - need) };
                }
              }
              return c;
            }).filter(c => (Array.isArray(c.sizes) ? c.sizes.length > 0 : Number(c.quantity || 0) > 0));
          } else if (cartItem.size && newSizes) {
            newSizes = newSizes.map(s => s.size === cartItem.size ? { ...s, qty: Math.max(0, Number(s.qty || 0) - need) } : s).filter(s => Number(s.qty || 0) > 0);
          }

          const newTotalQty = computeNewTotalQuantity(newColors, newSizes, Number(prodData.quantity || 0));
          if (newTotalQty <= 0) {
            await deleteDoc(prodRef);
          } else {
            const updateObj = { quantity: newTotalQty };
            if (newColors) updateObj.colors = newColors.map(c => {
              const o = { color: c.color };
              if (Array.isArray(c.sizes)) o.sizes = c.sizes.map(s => ({ size: s.size, qty: Number(s.qty || 0) }));
              if (c.quantity !== undefined) o.quantity = c.quantity;
              return o;
            });
            if (newSizes) updateObj.sizes = newSizes.map(s => ({ size: s.size, qty: Number(s.qty || 0) }));
            await updateDoc(prodRef, updateObj);
          }
        } else {
          // decreasing quantity in cart -> we do not restore here (user removes item or presses - to reduce)
          // For simplicity we let "delete from cart" restore the reserved quantity (handled in handleDeleteCartItem).
          // If you want to restore on decrease, we can implement that too.
          const newTotal = newQty * cartItem.sellPrice;
          await updateDoc(doc(db, "cart", cartItem.id), {
            quantity: newQty,
            total: newTotal,
          });
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
            let newColors = Array.isArray(prodData.colors) ? prodData.colors.map(c => {
              return {
                color: c.color,
                sizes: Array.isArray(c.sizes) ? c.sizes.map(s => ({ size: s.size, qty: Number(s.qty ?? s.quantity ?? 0) })) : undefined,
                quantity: c.quantity !== undefined ? Number(c.quantity) : undefined
              };
            }) : null;
            let newSizes = Array.isArray(prodData.sizes) ? prodData.sizes.map(s => ({ size: s.size, qty: Number(s.qty ?? s.quantity ?? 0) })) : null;

            if (cartData.color) {
              const found = newColors && newColors.find(c => c.color === cartData.color);
              if (found) {
                // if found and has sizes array and cartData.size provided -> restore to that specific size
                if (cartData.size && Array.isArray(found.sizes)) {
                  newColors = newColors.map(c => {
                    if (c.color === cartData.color) {
                      const sizesCopy = c.sizes.map(s => ({ ...s }));
                      const target = sizesCopy.find(s => s.size === cartData.size);
                      if (target) {
                        target.qty = Number(target.qty || 0) + Number(cartData.quantity || 0);
                      } else {
                        sizesCopy.push({ size: cartData.size, qty: Number(cartData.quantity || 0) });
                      }
                      return { ...c, sizes: sizesCopy };
                    }
                    return c;
                  });
                } else if (!cartData.size && Array.isArray(found.sizes)) {
                  // restore by adding to first size or create an aggregated 'الكمية' size
                  newColors = newColors.map(c => {
                    if (c.color === cartData.color) {
                      // try to append to a generic size 'الكمية' if exists
                      const sizesCopy = c.sizes.map(s => ({ ...s }));
                      const generic = sizesCopy.find(s => s.size === "الكمية");
                      if (generic) {
                        generic.qty = Number(generic.qty || 0) + Number(cartData.quantity || 0);
                      } else {
                        sizesCopy.push({ size: "الكمية", qty: Number(cartData.quantity || 0) });
                      }
                      return { ...c, sizes: sizesCopy };
                    }
                    return c;
                  });
                } else {
                  // legacy: restore color.quantity
                  newColors = newColors.map(c => c.color === cartData.color ? { ...c, quantity: Number(c.quantity || 0) + Number(cartData.quantity || 0) } : c);
                }
              } else {
                // color not found -> add it
                const addObj = cartData.size ? { color: cartData.color, sizes: [{ size: cartData.size, qty: Number(cartData.quantity || 0) }] } : { color: cartData.color, quantity: Number(cartData.quantity || 0) };
                newColors = [...(newColors || []), addObj];
              }
            }

            if (cartData.size && !cartData.color) {
              const foundS = newSizes && newSizes.find(s => s.size === cartData.size);
              if (foundS) {
                newSizes = newSizes.map(s => s.size === cartData.size ? { ...s, qty: Number(s.qty || 0) + Number(cartData.quantity || 0) } : s);
              } else {
                newSizes = [...(newSizes || []), { size: cartData.size, qty: Number(cartData.quantity || 0) }];
              }
            }

            // fallback to quantity field if neither variant exists
            const newTotalQty = computeNewTotalQuantity(newColors, newSizes, Number(prodData.quantity || 0));
            const updateObj = { quantity: newTotalQty };
            if (newColors) updateObj.colors = newColors.map(c => {
              const o = { color: c.color };
              if (Array.isArray(c.sizes)) o.sizes = c.sizes.map(s => ({ size: s.size, qty: Number(s.qty || 0) }));
              if (c.quantity !== undefined) o.quantity = c.quantity;
              return o;
            });
            if (newSizes) updateObj.sizes = newSizes.map(s => ({ size: s.size, qty: Number(s.qty || 0) }));
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
            if (cartData.color) {
              if (cartData.size) toAdd.colors = [{ color: cartData.color, sizes: [{ size: cartData.size, qty: cartData.quantity || 0 }] }];
              else toAdd.colors = [{ color: cartData.color, quantity: cartData.quantity || 0 }];
            }
            if (cartData.size && !cartData.color) toAdd.sizes = [{ size: cartData.size, qty: cartData.quantity || 0 }];
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
    if (!foundProduct) return;

    if ((foundProduct.colors && foundProduct.colors.length > 0) || (foundProduct.sizes && foundProduct.sizes.length > 0)) {
      openVariantForProduct(foundProduct);
    } else {
      // تحقق لو المنتج البسيط موجود بالفعل في الكارت
      const alreadyInCart = cart.some(item => item.originalProductId === foundProduct.id && !item.color && !item.size);
      if (!alreadyInCart) await addToCartAndReserve(foundProduct, { quantity: 1 });
    }

    setSearchCode(""); // مسح البحث بعد الاختيار
  }, 400);

  return () => clearTimeout(timer);
}, [searchCode, products, shop])
useEffect(() => {
  const totalMaxDiscount = products.reduce((acc, item) => {
    const maxDiscountPerItem = item.sellPrice - item.finalPrice;
    return acc + maxDiscountPerItem;
  }, 0);

  setTotalMaxDiscount(totalMaxDiscount); // نخزن الحد الكلي للخصم في state
}, [products]);

const handleApplyDiscount = () => {
  const numeric = Number(discountInput) || 0;

  if (numeric < 0) {
    alert('الخصم لا يمكن أن يكون قيمة سالبة');
    return;
  }

  // حساب الحد الأقصى للخصم مباشرة من المنتجات
  const totalMaxDiscount = products.reduce((acc, item) => {
    return acc + (item.sellPrice - item.finalPrice);
  }, 0);

  if (numeric > totalMaxDiscount) {
    alert(`الخصم أكبر من الحد المسموح به. أقصى خصم ممكن للفاتورة هو ${totalMaxDiscount}`);
    return;
  }

  setAppliedDiscount(numeric);
  setShowDiscountPopup(false);
};







  const handleClearDiscount = () => {
    setAppliedDiscount(0);
    setDiscountInput(0);
    setDiscountNotes("");
  };

  const totalAmount = subtotal;

  // 1️⃣ state للـ popup


// 2️⃣ فتح الـ popup عند الضغط على المنتج
const openEditPricePopup = (item) => {
  console.log('فتح popup:', item);
  setProductToEdit(item);
  setNewPriceInput(item.sellPrice);
  setTimeout(() => setEditPricePopup(true), 0); // يضمن ظهور popup بعد تحديث state
};


// 3️⃣ حفظ السعر الجديد
const handleSaveNewPrice = () => {
  if (!productToEdit) return;
  const numericPrice = Number(newPriceInput);
  if (numericPrice <= 0) {
    alert("السعر يجب أن يكون أكبر من صفر");
    return;
  }

  // تحديث السعر في cart
  setCart(prev => prev.map(item =>
    item.id === productToEdit.id
      ? { ...item, sellPrice: numericPrice, total: numericPrice * item.quantity }
      : item
  ));

  setEditPricePopup(false);
  setProductToEdit(null);
};

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

    // 🧾 جلب رقم الفاتورة التسلسلي من Firestore
    const counterRef = doc(db, "counters", "invoiceCounter");
    const invoiceNumber = await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterRef);
      let currentNumber = 0;

      if (counterSnap.exists()) {
        currentNumber = counterSnap.data().lastInvoiceNumber || 0;
      }

      const newNumber = currentNumber + 1;
      transaction.set(counterRef, { lastInvoiceNumber: newNumber }, { merge: true });
      return newNumber;
    });

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

    // 🔥 البيانات بعد إضافة رقم الفاتورة
    const saleData = {
      invoiceNumber,   // ← رقم الفاتورة الجديد
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
        invoiceNumber,
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
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const todayStr = `${day}/${month}/${year}`; // "DD/MM/YYYY"

    // 1️⃣ استعلام عن مبيعات اليوم لنفس المتجر
    const salesQuery = query(
      collection(db, "dailySales"),
      where("shop", "==", shop)
    );
    const salesSnapshot = await getDocs(salesQuery);

    if (salesSnapshot.empty) {
      alert("لا يوجد عمليات لتقفيلها اليوم");
      return;
    }

    // 2️⃣ استعلام عن كل المصروفات لنفس المتجر
    const masrofatQuery = query(
      collection(db, "masrofat"),
      where("shop", "==", shop)
    );
    const masrofatSnapshot = await getDocs(masrofatQuery);

    // 3️⃣ حساب إجمالي المبيعات
    let totalSales = 0;
    salesSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      totalSales += data.total || 0;
    });

    // 4️⃣ حساب إجمالي المصروفات الخاصة باليوم والمصروفات من المرتجعات
    let totalMasrofat = 0;
    let returnedProfit = 0;
    masrofatSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.date === todayStr) {
        if (data.reason === "فاتورة مرتجع") {
          returnedProfit += data.profit || 0; // ربح المرتجع
        } else {
          totalMasrofat += data.masrof || 0; // المصروفات العادية
        }
      }
    });

    let netMasrof = 0;
    masrofatSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      netMasrof += data.masrof;
    });

    // 6️⃣ إنشاء Batch لحفظ التقارير وحذف المبيعات
    const batch = writeBatch(db);

    // حفظ كل مستند من dailySales في reports
    for (const docSnap of salesSnapshot.docs) {
      const data = docSnap.data();
      const reportRef = doc(collection(db, "reports"));
      batch.set(reportRef, data); // حفظ نسخة من كل عملية في reports
      batch.delete(docSnap.ref);   // حذف مستند dailySales الأصلي
    }

    // حفظ صافي اليوم في dailyProfit
    const profitData = {
      shop,
      date: todayStr,
      totalSales,
      totalMasrofat: Number(netMasrof),
      returnedProfit,
      createdAt: Timestamp.now()
    };
    const profitRef = doc(collection(db, "dailyProfit"));
    batch.set(profitRef, profitData);

    // ⭐⭐⭐ الإضافة الجديدة: نسخ كل المصروفات قبل حذفها ⭐⭐⭐
    masrofatSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      const historyRef = doc(collection(db, "masrofatHistory"));
      batch.set(historyRef, {
        ...data,
        closedAt: todayStr,
        closedAtTimestamp: Timestamp.now()
      });
    });

    // 7️⃣ حذف كل المصروفات الخاصة باليوم
    masrofatSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.date === todayStr) {
        batch.delete(docSnap.ref);
      }
    });

    // 8️⃣ تنفيذ كل العمليات دفعة واحدة
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
  inv.invoiceNumber?.toString().includes(searchClient)
);


// ✅ حساب إجمالي كل المصروفات
const totalMasrofat = masrofat.reduce((sum, i) => sum + Number(i.masrof || 0), 0);

const totalSales = filteredInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
const finallyTotal = Number(totalSales) - Number(totalMasrofat);


  const employeeSales = {};
  filteredInvoices.forEach((invoice) => {
    if (invoice.employee && invoice.employee !== "غير محدد") {
      employeeSales[invoice.employee] = (employeeSales[invoice.employee] || 0) + invoice.total;
    }
  });
  const topEmployee =
    Object.entries(employeeSales).sort((a, b) => b[1] - a[1])[0]?.[0] || "لا يوجد موظفين";

    const handleAddPriceProduct = async () => {
  if (!variantProduct) return;

  // إضافة المنتج للسلة مع السعر الجديد
  await addToCartAndReserve(variantProduct, {
    price: newPriceInput,
    quantity: 1
  });

  // اغلاق الـ popup بعد الإضافة
  setShowPricePopup(false);
  setVariantProduct(null);
};

  // return product (refund) -> restore color/size quantities to lacosteProducts
const handleReturnProduct = async (item, invoiceId) => {
  try {
    // البحث عن المنتج وتحديثه أو إنشاؤه
    let prodRef = null;
    if (item.originalProductId) {
      prodRef = doc(db, "lacosteProducts", item.originalProductId);
    } else {
      const q = query(
        collection(db, "lacosteProducts"),
        where("code", "==", item.code),
        where("shop", "==", item.shop)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) prodRef = snapshot.docs[0].ref;
    }

    if (prodRef) {
      const prodSnap = await getDoc(prodRef);
      if (prodSnap.exists()) {
        const prodData = prodSnap.data();

        let newColors = Array.isArray(prodData.colors)
          ? prodData.colors.map(c => ({
              color: c.color,
              sizes: Array.isArray(c.sizes)
                ? c.sizes.map(s => ({ size: s.size, qty: Number(s.qty ?? s.quantity ?? 0) }))
                : undefined,
              quantity: c.quantity !== undefined ? Number(c.quantity) : undefined,
            }))
          : null;

        let newSizes = Array.isArray(prodData.sizes)
          ? prodData.sizes.map(s => ({ size: s.size, qty: Number(s.qty ?? s.quantity ?? 0) }))
          : null;

        // 🔹 المنتج له لون
        if (item.color) {
          const found = newColors && newColors.find(c => c.color === item.color);
          if (found) {
            if (item.size && Array.isArray(found.sizes)) {
              newColors = newColors.map(c => {
                if (c.color === item.color) {
                  const sizesCopy = c.sizes.map(s => ({ ...s }));
                  const target = sizesCopy.find(s => s.size === item.size);
                  if (target) {
                    target.qty += Number(item.quantity || 0);
                  } else {
                    sizesCopy.push({ size: item.size, qty: Number(item.quantity || 0) });
                  }
                  return { ...c, sizes: sizesCopy };
                }
                return c;
              });
            } else if (!item.size && Array.isArray(found.sizes)) {
              const sizesCopy = found.sizes.map(s => ({ ...s }));
              const generic = sizesCopy.find(s => s.size === "الكمية");
              if (generic) generic.qty += Number(item.quantity || 0);
              else sizesCopy.push({ size: "الكمية", qty: Number(item.quantity || 0) });
              newColors = newColors.map(c => c.color === item.color ? { ...c, sizes: sizesCopy } : c);
            } else {
              newColors = newColors.map(c => c.color === item.color ? { ...c, quantity: (c.quantity || 0) + Number(item.quantity || 0) } : c);
            }
          } else {
            const addObj = item.size
              ? { color: item.color, sizes: [{ size: item.size, qty: Number(item.quantity || 0) }] }
              : { color: item.color, quantity: Number(item.quantity || 0) };
            newColors = [...(newColors || []), addObj];
          }
        }
        // 🔹 المنتج له مقاس فقط
        else if (item.size && !item.color) {
          const foundS = newSizes && newSizes.find(s => s.size === item.size);
          if (foundS) newSizes = newSizes.map(s => s.size === item.size ? { ...s, qty: (s.qty || 0) + Number(item.quantity || 0) } : s);
          else newSizes = [...(newSizes || []), { size: item.size, qty: Number(item.quantity || 0) }];
        }
        // 🔹 المنتج بسيط (كمية فقط)
        else if (!item.color && !item.size) {
          const newQty = (Number(prodData.quantity) || 0) + Number(item.quantity || 0);
          await updateDoc(prodRef, { quantity: newQty });
        }

        // تحديث باقي بيانات المنتج في المخزون إذا كان له لون أو مقاس
        if (item.color || item.size) {
          const newTotalQty = computeNewTotalQuantity(newColors, newSizes, Number(prodData.quantity || 0));
          const updateObj = { quantity: newTotalQty };
          if (newColors) updateObj.colors = newColors.map(c => {
            const o = { color: c.color };
            if (Array.isArray(c.sizes)) o.sizes = c.sizes.map(s => ({ size: s.size, qty: Number(s.qty || 0) }));
            if (c.quantity !== undefined) o.quantity = c.quantity;
            return o;
          });
          if (newSizes) updateObj.sizes = newSizes.map(s => ({ size: s.size, qty: Number(s.qty || 0) }));
          await updateDoc(prodRef, updateObj);
        }
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
        if (item.color) toAdd.colors = [{ color: item.color, sizes: [{ size: item.size || "الكمية", qty: item.quantity || 0 }] }];
        if (item.size && !item.color) toAdd.sizes = [{ size: item.size, qty: item.quantity || 0 }];
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
      if (item.color) toAdd.colors = [{ color: item.color, sizes: [{ size: item.size || "الكمية", qty: item.quantity || 0 }] }];
      if (item.size && !item.color) toAdd.sizes = [{ size: item.size, qty: item.quantity || 0 }];
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
            <button onClick={toggleHidden} className={styles.eye} style={{marginTop: '15px'}}>
            {isHidden ? "👁️ إظهار الأرقام" : "🙈 إخفاء الأرقام"}
          </button>
            <div className={styles.searchBox}>
            <IoMdSearch />
            <input
              type="text"
              placeholder="ابحث برقم الفاتورة..."
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
              <p>{isHidden? '****' : filteredInvoices.length}</p>
            </div>
            <div className={styles.card}>
              <h4>إجمالي المبيعات</h4>
              <p>{isHidden? '****' : filteredInvoices.length > 0 ? totalSales : 0} جنيه</p>
            </div>
            <div className={styles.card}>
              <h4>إجمالي المصروفات</h4>
              <p>{isHidden? '****' : totalMasrofat} جنيه</p>
            </div>
            <div className={styles.card}>
              <h4>صافي المبيع </h4>
              <p>{isHidden? '****' : filteredInvoices.length > 0 ? finallyTotal : 0} جنيه</p>
            </div>
            <div className={styles.card}>
              <h4>أنشط موظف</h4>
              <p>{isHidden? '****' : topEmployee}</p>
            </div>
          </div>
          
          {filteredInvoices.length === 0 ? (
            <p>لا توجد عمليات بعد اليوم</p>
          ) : (
            <div className={styles.tableContainer}>
              <table>
              <thead>
                <tr>
                  <th>رقم الفاتورة</th>
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
                    <td>{invoice.invoiceNumber || "بدون اسم"}</td>
                    <td>{invoice.clientName || "بدون اسم"}</td>
                    <td>{invoice.phone || "-"}</td>
                    <td>{invoice.employee || "غير محدد"}</td>
                    <td>{isHidden? '****' : invoice.total} جنيه</td>
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
              {/* {selectedInvoice.profit !== undefined && (
                <p><strong>📈 ربح الفاتورة:</strong> {selectedInvoice.profit} جنيه</p>
              )} */}
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
    <div
      className={styles.ordersContainer}
      key={item.id}
    >
      <div className={styles.orderInfo}>
        <div className={styles.content}>
          <button onClick={(e) => { e.stopPropagation(); handleDeleteCartItem(item.id); }}>
            <FaRegTrashAlt />
          </button>
          <button
  onClick={(e) => { 
    e.stopPropagation(); // يمنع propagation
    openEditPricePopup(item); 
  }}
>
   ت
</button>

          <div className={styles.text}>
            <h4>{item.name} {item.color ? ` - ${item.color}` : ""} {item.size ? ` - ${item.size}` : ""}</h4>
            <p>{item.total} EGP</p>
          </div>
        </div>
        <div className={styles.qtyInput}>
          <button onClick={(e) => { e.stopPropagation(); handleQtyChange(item, -1); }}>-</button>
          <input type="text" value={item.quantity} readOnly />
          <button onClick={(e) => { e.stopPropagation(); handleQtyChange(item, 1); }}>+</button>
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
                {/* <div><strong>📈 ربح الفاتورة:</strong> {profit} جنيه</div> */}
                <div><strong>🔖 الخصم:</strong> {appliedDiscount} جنيه {appliedDiscount > 0 ? `(ملاحظة: ${discountNotes || '-'})` : null}</div>
                <div><strong>🔖 الحد الاقصى للخصم:</strong> {appliedDiscount} جنيه {totalMaxDiscount > 0 ? `(ملاحظة: ${discountNotes || '-'})` : null}</div>
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

      {/* NEW: Variant selection popup (color buttons -> sizes list -> qty per size) */}
      {showVariantPopup && variantProduct && (
        <div className={styles.popupOverlay} onClick={() => { setShowVariantPopup(false); setVariantProduct(null); }}>
          <div className={styles.popupBox} onClick={(e) => e.stopPropagation()}>
            <h3>اختر اللون والمقاسات — {variantProduct.name}</h3>

            {/* الألوان كـ buttons */}
            {variantProduct.colors && variantProduct.colors.length > 0 && (
              <>
                <label>الألوان المتاحة:</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {variantProduct.colors.map((c, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        // switch color and rebuild variantSizeMap
                        setVariantSelectedColor(c.color);
                        const map = {};
                        if (Array.isArray(c.sizes) && c.sizes.length) {
                          c.sizes.forEach(s => map[s.size] = 0);
                        } else if (variantProduct.sizes && variantProduct.sizes.length) {
                          variantProduct.sizes.forEach(s => map[s.size] = 0);
                        }
                        setVariantSizeMap(map);
                      }}
                      style={{
                        padding: '6px 10px',
                        border: variantSelectedColor === c.color ? '2px solid #0b5ed7' : '1px solid #ccc',
                        borderRadius: 6,
                        background: variantSelectedColor === c.color ? '#e9f2ff' : 'white',
                        cursor: 'pointer'
                      }}
                    >
                      {c.color} ({ Array.isArray(c.sizes) ? c.sizes.reduce((s,it)=>s+Number(it.qty||it.quantity||0),0) : (c.quantity||0) })
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* المقاسات الخاصة باللون المحدد */}
            <div>
              <label>المقاسات للون: {variantSelectedColor || '—'}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                {variantSelectedColor ? (
                  (() => {
                    // find sizes for selected color
                    const colorObj = Array.isArray(variantProduct.colors) ? variantProduct.colors.find(x => x.color === variantSelectedColor) : null;
                    const sizesArr = colorObj && Array.isArray(colorObj.sizes) && colorObj.sizes.length ? colorObj.sizes : (variantProduct.sizes || []);
                    if (!sizesArr || sizesArr.length === 0) {
                      return <div style={{ color: '#777' }}>لا توجد مقاسات لهذا اللون</div>;
                    }
                    return sizesArr.map((s, si) => {
                      const available = Number(s.qty ?? s.quantity ?? 0);
                      const current = Number(variantSizeMap[s.size] || 0);
                      return (
                        <div key={si} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: '1px solid #eee', background: '#fff' }}>
                          <div style={{ fontWeight: 600 }}>{s.size}</div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <div style={{ color: '#666' }}>متاح: {available}</div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <button onClick={() => {
                                setVariantSizeMap(prev => ({ ...prev, [s.size]: Math.max(0, (Number(prev[s.size] || 0) - 1)) }));
                              }}>-</button>
                              <input type="number" value={current} onChange={(e) => {
                                const v = Math.max(0, Number(e.target.value || 0));
                                setVariantSizeMap(prev => ({ ...prev, [s.size]: v }));
                              }} style={{ width: 60, textAlign: 'center' }} />
                              <button onClick={() => {
                                setVariantSizeMap(prev => {
                                  const newVal = Math.min(available, (Number(prev[s.size] || 0) + 1));
                                  return { ...prev, [s.size]: newVal };
                                });
                              }}>+</button>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()
                ) : (
                  <div style={{ color: '#777' }}>اختر لونًا أولًا لعرض المقاسات</div>
                )}
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <h4>السعر النهائي الافتراضي: {variantProduct?.finalPrice}</h4>
  <label>السعر:</label>
<input
  type="number"
  value={newPriceInput}
  placeholder={`أدخل سعر ≥ ${variantProduct.finalPrice}`}
  onChange={(e) => {
    const val = Number(e.target.value || 0);
    setNewPriceInput(val); // السماح للمستخدم بكتابة أي سعر
  }}
  style={{ width: 100, marginLeft: 8 }}
/>




</div>


            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={() => { setShowVariantPopup(false); setVariantProduct(null); }}>إلغاء</button>
<button onClick={async () => {
  // التحقق من السعر قبل أي إضافة
  if (!newPriceInput || newPriceInput < variantProduct.finalPrice) {
  alert(`السعر الذي أدخلته أقل من السعر النهائي: ${variantProduct.finalPrice}`);
  return;
}
  if (!newPriceInput || newPriceInput > variantProduct.sellPrice) {
  alert(`السعر الذي أدخلته اكبر من السعر النهائي: ${variantProduct.sellPrice}`);
  return;
}


  // جمع المقاسات المختارة بالكمية > 0
  const entries = Object.entries(variantSizeMap)
    .map(([size, q]) => ({ size, qty: Number(q || 0) }))
    .filter(e => e.qty > 0);

  if (!entries.length) {
    alert("اختر كمية على الأقل لمقاس واحد قبل الإضافة");
    return;
  }

  // إضافة كل مقاس للسلة
  for (const e of entries) {
    const prodRef = doc(db, "lacosteProducts", variantProduct.id);
    const prodSnap = await getDoc(prodRef);
    const prodData = prodSnap.exists() ? prodSnap.data() : variantProduct;
    const availableNow = getAvailableForVariant(prodData, variantSelectedColor, e.size);

    if (e.qty > availableNow) {
      alert(`الكمية المطلوبة للمقاس ${e.size} (${e.qty}) أكبر من المتاح حاليا (${availableNow}). لن تُضاف هذا المقاس.`);
      continue;
    }

    await addToCartAndReserve(variantProduct, { 
      color: variantSelectedColor, 
      size: e.size, 
      quantity: e.qty,
      price: newPriceInput // السعر الذي أدخله المستخدم
    });
  }

  // إغلاق الـ popup وتفريغ الحقول
  setShowVariantPopup(false);
  setVariantProduct(null);
  setVariantSelectedColor("");
  setVariantSizeMap({});
  setProductToEdit(null);
  setNewPriceInput(""); // تفريغ الحقل بعد الإضافة
}}>
  أضف للسلة
</button>


            </div>
          </div>
        </div>
      )}
      {editPricePopup && productToEdit && (
  <div className={styles.popupOverlay}>
    <div className={styles.popupBox}>
      <h3>تعديل سعر {productToEdit.name}</h3>
      <div className="inputContainer">
        <input
        type="number"
        value={newPriceInput}
        onChange={(e) => setNewPriceInput(e.target.value)}
      />
      </div>
      <div className={styles.popupBtns}>
        <button onClick={handleSaveNewPrice}>حفظ السعر</button>
      <button onClick={() => setEditPricePopup(false)}>إلغاء</button>
      </div>
    </div>
  </div>
)}
{showPricePopup && (
  <div className={styles.popupOverlay}>
 <div className={styles.popupBox}>
     <h3>أدخل السعر للمنتج</h3>
     <h4>السعر النهائي الافتراضي: {variantProduct?.finalPrice}</h4>
    <input 
      type="number" 
      value={newPriceInput} 
      onChange={(e) => setNewPriceInput(Number(e.target.value))} 
    />
  <div className={styles.popupBtns}>
    <button onClick={async () => {
  if (!variantProduct) return;

  if (!newPriceInput || newPriceInput < variantProduct.finalPrice) {
    alert(`السعر الذي أدخلته أقل من السعر الافتراضي: ${variantProduct.finalPrice}`);
    return;
  }
  if (!newPriceInput || newPriceInput > variantProduct.sellPrice) {
    alert(`السعر الذي أدخلته اكبر من السعر الافتراضي: ${variantProduct.sellPrice}`);
    return;
  }

  const hasColors = variantProduct.colors && variantProduct.colors.length > 0;
  const hasSizes = variantProduct.sizes && variantProduct.sizes.length > 0;

  if (!hasColors && !hasSizes) {
    // إضافة المنتج للسلة أولًا
    await addDoc(collection(db, "cart"), {
      name: variantProduct.name,
      sellPrice: Number(newPriceInput),
      productPrice: variantProduct.sellPrice,
      quantity: 1,
      type: variantProduct.type,
      total: Number(newPriceInput),
      date: new Date(),
      shop: shop,
      color: "",
      size: "",
      originalProductId: variantProduct.id,
      code: variantProduct.code || "",
      buyPrice: variantProduct.buyPrice || 0,
    });

    // تحديث المخزون في Firestore لو محتاج
    const prodRef = doc(db, "lacosteProducts", variantProduct.id);
    const prodSnap = await getDoc(prodRef);
    if (prodSnap.exists()) {
      const prodData = prodSnap.data();
      if (prodData.quantity !== undefined) {
        const newQty = Math.max(0, Number(prodData.quantity) - 1);
        if (newQty <= 0) await deleteDoc(prodRef);
        else await updateDoc(prodRef, { quantity: newQty });
      }
    }

    // إغلاق popup
    setShowPricePopup(false);
    setVariantProduct(null);
    setNewPriceInput("");
    return;
  }

  // الكود القديم للمنتجات اللي ليها ألوان أو مقاسات...
}}>
  أضف للسلة
</button>
    <button onClick={() => setShowPricePopup(false)}>إلغاء</button>
  </div>
 </div>
  </div>
)}




    </div>
  );
}

export default Main;
