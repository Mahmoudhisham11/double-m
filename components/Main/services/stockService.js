// Service for stock management
import {
  collection,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
} from "firebase/firestore";
import { db } from "@/app/firebase";
import { computeNewTotalQuantity, getAvailableQuantity } from "@/utils/productHelpers";

export const stockService = {
  async updateStockAfterSale(cartItems) {
    if (!Array.isArray(cartItems) || cartItems.length === 0) return;

    for (const item of cartItems) {
      if (!item.originalProductId && !item.code) continue;

      const isOffer = item.isOffer || false;
      let collectionName = isOffer ? "offers" : "lacosteProducts";
      let prodRef = null;
      let prodSnap = null;

      // محاولة البحث بالـ id أولاً
      if (item.originalProductId) {
        prodRef = doc(db, collectionName, item.originalProductId);
        prodSnap = await getDoc(prodRef);
      }

      // لو المنتج مش موجود بالـ id، جرّب البحث بالكود
      if ((!prodSnap || !prodSnap.exists()) && item.code) {
        const shop = item.shop || (typeof window !== "undefined" ? localStorage.getItem("shop") : null);
        
        // البحث بالكود في نفس الـ collection
        const q = query(
          collection(db, collectionName),
          where("code", "==", item.code.toString()),
          ...(shop ? [where("shop", "==", shop)] : [])
        );
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const docSnap = querySnapshot.docs[0];
          prodRef = docSnap.ref;
          prodSnap = docSnap;
        } else {
          // جرّب الـ collection التاني
          const alternateCollection = isOffer ? "lacosteProducts" : "offers";
          const alternateQuery = query(
            collection(db, alternateCollection),
            where("code", "==", item.code.toString()),
            ...(shop ? [where("shop", "==", shop)] : [])
          );
          const alternateSnapshot = await getDocs(alternateQuery);
          if (!alternateSnapshot.empty) {
            const docSnap = alternateSnapshot.docs[0];
            prodRef = docSnap.ref;
            prodSnap = docSnap;
            collectionName = alternateCollection;
          }
        }
      }

      if (!prodSnap || !prodSnap.exists()) {
        console.warn(`Product not found: ${item.name} (code: ${item.code}, id: ${item.originalProductId})`);
        continue;
      }

      const prodData = prodSnap.data();
      
      // Handle products with colors and sizes
      if (item.color || item.size) {
        let newColors = Array.isArray(prodData.colors)
          ? prodData.colors.map((c) => {
              if (c.color === item.color) {
                if (item.size && Array.isArray(c.sizes)) {
                  const sizesCopy = c.sizes.map((s) => ({ ...s }));
                  const target = sizesCopy.find((s) => s.size === item.size);
                  if (target) {
                    target.qty = Math.max(0, Number(target.qty || 0) - item.quantity);
                  }
                  return {
                    ...c,
                    sizes: sizesCopy.filter((s) => Number(s.qty || 0) > 0),
                  };
                } else {
                  return {
                    ...c,
                    quantity: Math.max(0, Number(c.quantity || 0) - item.quantity),
                  };
                }
              }
              return c;
            })
            .filter((c) =>
              Array.isArray(c.sizes)
                ? c.sizes.length > 0
                : Number(c.quantity || 0) > 0
            )
          : null;

        let newSizes = Array.isArray(prodData.sizes)
          ? prodData.sizes
              .map((s) =>
                s.size === item.size
                  ? { ...s, qty: Math.max(0, Number(s.qty || 0) - item.quantity) }
                  : s
              )
              .filter((s) => Number(s.qty || 0) > 0)
          : null;

        // Calculate new total quantity based on colors and sizes only
        // Don't use fallbackOldQuantity to avoid keeping old quantity when colors/sizes are empty
        const newTotalQty = computeNewTotalQuantity(
          newColors,
          newSizes,
          0 // Use 0 as fallback instead of old quantity
        );

        // If no colors and no sizes left, or total quantity is 0 or less, delete the product
        if (newTotalQty <= 0 || (!newColors || newColors.length === 0) && (!newSizes || newSizes.length === 0)) {
          await deleteDoc(prodRef);
        } else {
          const updateObj = { quantity: newTotalQty };
          if (newColors && newColors.length > 0) {
            updateObj.colors = newColors.map((c) => {
              const o = { color: c.color };
              if (Array.isArray(c.sizes) && c.sizes.length > 0) {
                o.sizes = c.sizes.map((s) => ({
                  size: s.size,
                  qty: Number(s.qty || 0),
                }));
              }
              if (c.quantity !== undefined) o.quantity = Number(c.quantity || 0);
              return o;
            });
          } else {
            // If no colors left, remove colors field
            updateObj.colors = [];
          }
          if (newSizes && newSizes.length > 0) {
            updateObj.sizes = newSizes.map((s) => ({
              size: s.size,
              qty: Number(s.qty || 0),
            }));
          } else if (Array.isArray(prodData.sizes)) {
            // If sizes existed before but now empty, remove sizes field
            updateObj.sizes = [];
          }
          await updateDoc(prodRef, updateObj);
        }
      } else {
        // Simple product without variants
        const currentQty = Number(prodData.quantity || 0);
        const newQty = currentQty - item.quantity;

        if (newQty <= 0) {
          await deleteDoc(prodRef);
        } else {
          await updateDoc(prodRef, { quantity: newQty });
        }
      }
    }
  },

  async restoreStock(item) {
    try {
      // التأكد من وجود shop
      const shop = item.shop || (typeof window !== "undefined" ? localStorage.getItem("shop") : null);
      
      if (!shop) {
        throw new Error("Shop is required for restoring stock");
      }

      // تحديد collection المناسب بناءً على isOffer
      const isOffer = item.isOffer || false;
      const collectionName = isOffer ? "offers" : "lacosteProducts";

      let prodRef = null;

      if (item.originalProductId) {
        prodRef = doc(db, collectionName, item.originalProductId);
      } else {
        const q = query(
          collection(db, collectionName),
          where("code", "==", item.code),
          where("shop", "==", shop)
        );
        const snapshot = await getDocs(q);
        prodRef = snapshot.docs[0]?.ref;
      }

      // دالة مساعدة لإنشاء منتج جديد
      const createNewProduct = async () => {
        const newProd = {
          name: item.name || "منتج بدون اسم",
          code: item.code,
          quantity: item.quantity || 0,
          buyPrice: item.buyPrice || 0,
          sellPrice: item.sellPrice || 0,
          finalPrice: item.finalPrice || item.sellPrice || 0,
          section: item.section || "",
          merchantName: item.merchantName || "",
          shop: shop,
          type: item.type || "product",
        };

        // إضافة حقول العروض إذا كان من العروض
        if (isOffer) {
          newProd.isOffer = true;
          // استخدام الأسعار الحالية كأسعار العرض
          newProd.sellPrice = item.sellPrice || 0;
          newProd.finalPrice = item.finalPrice || item.sellPrice || 0;
          // حفظ الأسعار الأصلية إذا كانت موجودة، وإلا استخدام الأسعار الحالية
          newProd.originalSellPrice = item.originalSellPrice || item.sellPrice || 0;
          newProd.originalFinalPrice = item.originalFinalPrice || item.finalPrice || item.sellPrice || 0;
        }

        if (item.color) {
          newProd.colors = [
            {
              color: item.color,
              sizes: item.size ? [{ size: item.size, qty: item.quantity || 0 }] : undefined,
              quantity: item.size ? undefined : (item.quantity || 0),
            },
          ];
          // إزالة الحقول undefined
          if (newProd.colors[0].sizes === undefined) {
            delete newProd.colors[0].sizes;
          }
          if (newProd.colors[0].quantity === undefined) {
            delete newProd.colors[0].quantity;
          }
        }
        if (item.size && !item.color) {
          newProd.sizes = [{ size: item.size, qty: item.quantity || 0 }];
        }

        await addDoc(collection(db, collectionName), newProd);
      };

      if (!prodRef) {
        // Create new product
        await createNewProduct();
        return;
      }

      const prodSnap = await getDoc(prodRef);
      if (!prodSnap.exists()) {
        // Create new product
        await createNewProduct();
        return;
      }

      const data = prodSnap.data();
      let updatedData = { ...data };

      // تحديث البيانات الإضافية من المنتج المرتجع إذا كانت موجودة
      // نحافظ على البيانات الأصلية إذا كانت موجودة، أو نضيفها من المنتج المرتجع
      if (item.finalPrice && !updatedData.finalPrice) {
        updatedData.finalPrice = item.finalPrice;
      }
      if (item.section && !updatedData.section) {
        updatedData.section = item.section;
      }
      if (item.merchantName && !updatedData.merchantName) {
        updatedData.merchantName = item.merchantName;
      }

      // Restore based on variant type
      if (item.color && Array.isArray(updatedData.colors)) {
        // البحث عن اللون المطابق
        let colorFound = false;
        updatedData.colors = updatedData.colors.map((c) => {
          if (c.color === item.color) {
            colorFound = true;
            if (item.size && Array.isArray(c.sizes)) {
              // البحث عن المقاس المطابق
              let sizeFound = false;
              c.sizes = c.sizes.map((s) => {
                if (s.size === item.size) {
                  sizeFound = true;
                  return { ...s, qty: (s.qty || 0) + Number(item.quantity) };
                }
                return s;
              });
              
              // إذا لم نجد المقاس، نضيفه
              if (!sizeFound) {
                c.sizes = [...(c.sizes || []), { size: item.size, qty: Number(item.quantity) }];
              }
            } else {
              // لا يوجد مقاس، نضيف للكمية العامة للون
              c.quantity = (c.quantity || 0) + Number(item.quantity);
            }
          }
          return c;
        });
        
        // إذا لم نجد اللون، نضيفه
        if (!colorFound) {
          const newColor = {
            color: item.color,
          };
          if (item.size) {
            newColor.sizes = [{ size: item.size, qty: Number(item.quantity) }];
          } else {
            newColor.quantity = Number(item.quantity);
          }
          updatedData.colors = [...(updatedData.colors || []), newColor];
        }
      } else if (item.size && Array.isArray(updatedData.sizes)) {
        // البحث عن المقاس
        let sizeFound = false;
        updatedData.sizes = updatedData.sizes.map((s) => {
          if (s.size === item.size) {
            sizeFound = true;
            return { ...s, qty: (s.qty || 0) + Number(item.quantity) };
          }
          return s;
        });
        
        // إذا لم نجد المقاس، نضيفه
        if (!sizeFound) {
          updatedData.sizes = [...(updatedData.sizes || []), { size: item.size, qty: Number(item.quantity) }];
        }
      } else if (!item.color && !item.size) {
        // منتج بسيط بدون variants
        updatedData.quantity =
          (updatedData.quantity || 0) + Number(item.quantity);
      }

      const totalQty = computeNewTotalQuantity(
        updatedData.colors,
        updatedData.sizes,
        updatedData.quantity
      );

      await updateDoc(prodRef, { ...updatedData, quantity: totalQty });
    } catch (error) {
      console.error("Error restoring stock:", error);
      throw error;
    }
  },
};
