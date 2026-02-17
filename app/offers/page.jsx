"use client";
import SideBar from "@/components/SideBar/page";
import styles from "./styles.module.css";
import { useState, useEffect, useMemo, useCallback } from "react";
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
} from "firebase/firestore";
import { db } from "../firebase";
import Loader from "@/components/Loader/Loader";
import {
  NotificationProvider,
  useNotification,
} from "@/contexts/NotificationContext";
import ConfirmModal from "@/components/Main/Modals/ConfirmModal";
import { FaPlus, FaTrash, FaUndo } from "react-icons/fa";
import { CiSearch } from "react-icons/ci";

function OffersContent() {
  const { success, error: showError } = useNotification();
  const router = useRouter();
  const [auth, setAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchCode, setSearchCode] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [offerToReturn, setOfferToReturn] = useState(null);
  const [offerToDelete, setOfferToDelete] = useState(null);
  const [sellPrice, setSellPrice] = useState("");
  const [finalPrice, setFinalPrice] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const shop =
    typeof window !== "undefined" ? localStorage.getItem("shop") : "";

  // التحقق من الصلاحيات
  useEffect(() => {
    const checkLock = async () => {
      try {
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

        if (!querySnapshot.empty) {
          const user = querySnapshot.docs[0].data();
          if (user.permissions?.products === true) {
            showError("ليس لديك الصلاحية للوصول إلى هذه الصفحة❌");
            router.push("/");
            return;
          } else {
            setAuth(true);
          }
        } else {
          router.push("/");
          return;
        }
      } catch (error) {
        console.error("Error checking permissions:", error);
        showError("حدث خطأ أثناء التحقق من الصلاحيات");
        router.push("/");
      } finally {
        setLoading(false);
      }
    };
    checkLock();
  }, [router, showError]);

  // جلب منتجات العروض
  useEffect(() => {
    if (!shop) return;

    const q = query(collection(db, "offers"), where("shop", "==", shop));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setOffers(data);
      },
      (err) => {
        console.error("Error fetching offers:", err);
        showError("حدث خطأ أثناء جلب العروض");
      }
    );

    return () => unsubscribe();
  }, [shop, showError]);

  // جلب المنتجات من lacosteProducts للاختيار
  useEffect(() => {
    if (!shop || !showAddModal) return;

    const q = query(
      collection(db, "lacosteProducts"),
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
        console.error("Error fetching products:", err);
        showError("حدث خطأ أثناء جلب المنتجات");
      }
    );

    return () => unsubscribe();
  }, [shop, showAddModal, showError]);

  // البحث عن منتج بالكود
  const handleSearchProduct = useCallback(() => {
    if (!searchCode.trim()) {
      showError("يرجى إدخال كود المنتج");
      return;
    }

    const foundProduct = products.find(
      (p) => p.code?.toString() === searchCode.trim()
    );

    if (!foundProduct) {
      showError("المنتج غير موجود");
      return;
    }

    // التحقق من أن المنتج غير موجود في العروض
    const alreadyInOffers = offers.some(
      (o) => o.code?.toString() === foundProduct.code?.toString()
    );

    if (alreadyInOffers) {
      showError("هذا المنتج موجود بالفعل في العروض");
      return;
    }

    setSelectedProduct(foundProduct);
    setSellPrice(foundProduct.sellPrice?.toString() || "");
    setFinalPrice(foundProduct.finalPrice?.toString() || "");
  }, [searchCode, products, offers, showError]);

  // إضافة منتج للعروض
  const handleAddToOffers = useCallback(async () => {
    if (!selectedProduct) {
      showError("يرجى اختيار منتج أولاً");
      return;
    }

    const sellPriceNum = Number(sellPrice);
    const finalPriceNum = Number(finalPrice);

    if (isNaN(sellPriceNum) || sellPriceNum <= 0) {
      showError("يرجى إدخال سعر بيع صحيح");
      return;
    }

    if (isNaN(finalPriceNum) || finalPriceNum <= 0) {
      showError("يرجى إدخال سعر نهائي صحيح");
      return;
    }

    setIsProcessing(true);
    try {
      // إنشاء كائن المنتج للعروض
      const offerProduct = {
        ...selectedProduct,
        sellPrice: sellPriceNum,
        finalPrice: finalPriceNum,
        originalSellPrice: selectedProduct.sellPrice || 0,
        originalFinalPrice: selectedProduct.finalPrice || 0,
        isOffer: true,
        date: Timestamp.now(),
        shop: shop,
      };

      // إضافة المنتج في offers
      await addDoc(collection(db, "offers"), offerProduct);

      // حذف المنتج من lacosteProducts
      await deleteDoc(doc(db, "lacosteProducts", selectedProduct.id));

      success("✅ تم إضافة المنتج للعروض بنجاح");
      setShowAddModal(false);
      setSelectedProduct(null);
      setSearchCode("");
      setSellPrice("");
      setFinalPrice("");
    } catch (error) {
      console.error("Error adding to offers:", error);
      showError("حدث خطأ أثناء إضافة المنتج للعروض");
    } finally {
      setIsProcessing(false);
    }
  }, [selectedProduct, sellPrice, finalPrice, shop, success, showError]);

  // إرجاع منتج من العروض
  const handleReturnFromOffers = useCallback(async () => {
    if (!offerToReturn) return;

    setIsProcessing(true);
    try {
      const offerRef = doc(db, "offers", offerToReturn.id);
      const offerSnap = await getDoc(offerRef);

      if (!offerSnap.exists()) {
        showError("المنتج غير موجود في العروض");
        setIsProcessing(false);
        return;
      }

      const offerData = offerSnap.data();

      // إنشاء منتج للعودة إلى lacosteProducts
      const returnProduct = {
        ...offerData,
        sellPrice: offerData.originalSellPrice || offerData.sellPrice,
        finalPrice: offerData.originalFinalPrice || offerData.finalPrice,
        isOffer: false,
        date: Timestamp.now(),
      };

      // إزالة الحقول الخاصة بالعروض
      delete returnProduct.originalSellPrice;
      delete returnProduct.originalFinalPrice;
      delete returnProduct.isOffer;

      // إضافة المنتج في lacosteProducts
      await addDoc(collection(db, "lacosteProducts"), returnProduct);

      // حذف من offers
      await deleteDoc(offerRef);

      success("✅ تم إرجاع المنتج بنجاح");
      setShowReturnModal(false);
      setOfferToReturn(null);
    } catch (error) {
      console.error("Error returning from offers:", error);
      showError("حدث خطأ أثناء إرجاع المنتج");
    } finally {
      setIsProcessing(false);
    }
  }, [offerToReturn, success, showError]);

  // حذف منتج من العروض
  const handleDeleteOffer = useCallback(async () => {
    if (!offerToDelete) return;

    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, "offers", offerToDelete.id));
      success("✅ تم حذف المنتج من العروض بنجاح");
      setShowDeleteModal(false);
      setOfferToDelete(null);
    } catch (error) {
      console.error("Error deleting offer:", error);
      showError("حدث خطأ أثناء حذف المنتج");
    } finally {
      setIsProcessing(false);
    }
  }, [offerToDelete, success, showError]);

  // تصفية العروض
  const filteredOffers = useMemo(() => {
    if (!searchCode.trim()) return offers;
    return offers.filter((offer) =>
      offer.code?.toString().includes(searchCode.trim())
    );
  }, [offers, searchCode]);

  if (loading) return <Loader />;
  if (!auth) return null;

  return (
    <div className={styles.offers}>
      <SideBar />
      <div className={styles.content}>
        <div className={styles.header}>
          <h2 className={styles.title}>العروض</h2>
          <button
            className={styles.addBtn}
            onClick={() => {
              setShowAddModal(true);
              setSearchCode("");
              setSelectedProduct(null);
            }}
          >
            <FaPlus />
            إضافة منتج للعروض
          </button>
        </div>

        <div className={styles.searchBox}>
          <CiSearch />
          <input
            type="text"
            placeholder="البحث بالكود..."
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>الكود</th>
                <th>الاسم</th>
                <th>سعر البيع</th>
                <th>السعر النهائي</th>
                <th>الكمية</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredOffers.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>
                    لا توجد عروض
                  </td>
                </tr>
              ) : (
                filteredOffers.map((offer) => (
                  <tr key={offer.id}>
                    <td>{offer.code || "-"}</td>
                    <td>{offer.name || "-"}</td>
                    <td>{offer.sellPrice?.toFixed(2) || "0.00"} جنيه</td>
                    <td>{offer.finalPrice?.toFixed(2) || "0.00"} جنيه</td>
                    <td>
                      {offer.colors
                        ? offer.colors.reduce((sum, c) => {
                            if (c.sizes) {
                              return (
                                sum +
                                c.sizes.reduce((s, size) => s + (size.qty || 0), 0)
                              );
                            }
                            return sum + (c.quantity || 0);
                          }, 0)
                        : offer.quantity || 0}
                    </td>
                    <td className={styles.actionsCell}>
                      <button
                        className={styles.returnBtn}
                        onClick={() => {
                          setOfferToReturn(offer);
                          setShowReturnModal(true);
                        }}
                        title="إرجاع"
                      >
                        <FaUndo />
                      </button>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => {
                          setOfferToDelete(offer);
                          setShowDeleteModal(true);
                        }}
                        title="حذف"
                      >
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal إضافة منتج */}
      {showAddModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            if (!isProcessing) {
              setShowAddModal(false);
              setSelectedProduct(null);
              setSearchCode("");
              setSellPrice("");
              setFinalPrice("");
            }
          }}
        >
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>إضافة منتج للعروض</h3>
            <div className={styles.modalContent}>
              <div className={styles.inputGroup}>
                <label>كود المنتج</label>
                <div className={styles.searchInputGroup}>
                  <input
                    type="text"
                    value={searchCode}
                    onChange={(e) => setSearchCode(e.target.value)}
                    placeholder="أدخل كود المنتج"
                    className={styles.modalInput}
                    disabled={isProcessing}
                  />
                  <button
                    className={styles.searchBtn}
                    onClick={handleSearchProduct}
                    disabled={isProcessing}
                  >
                    <CiSearch />
                    بحث
                  </button>
                </div>
              </div>

              {selectedProduct && (
                <>
                  <div className={styles.productInfo}>
                    <p>
                      <strong>الاسم:</strong> {selectedProduct.name}
                    </p>
                    <p>
                      <strong>الكود:</strong> {selectedProduct.code}
                    </p>
                    <p>
                      <strong>سعر البيع الحالي:</strong>{" "}
                      {selectedProduct.sellPrice?.toFixed(2) || "0.00"} جنيه
                    </p>
                    <p>
                      <strong>السعر النهائي الحالي:</strong>{" "}
                      {selectedProduct.finalPrice?.toFixed(2) || "0.00"} جنيه
                    </p>
                  </div>

                  <div className={styles.inputGroup}>
                    <label>سعر البيع للعرض</label>
                    <input
                      type="number"
                      value={sellPrice}
                      onChange={(e) => setSellPrice(e.target.value)}
                      placeholder="أدخل سعر البيع"
                      className={styles.modalInput}
                      min="0"
                      step="0.01"
                      disabled={isProcessing}
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>السعر النهائي للعرض</label>
                    <input
                      type="number"
                      value={finalPrice}
                      onChange={(e) => setFinalPrice(e.target.value)}
                      placeholder="أدخل السعر النهائي"
                      className={styles.modalInput}
                      min="0"
                      step="0.01"
                      disabled={isProcessing}
                    />
                  </div>
                </>
              )}
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedProduct(null);
                  setSearchCode("");
                  setSellPrice("");
                  setFinalPrice("");
                }}
                disabled={isProcessing}
              >
                إلغاء
              </button>
              <button
                className={styles.confirmBtn}
                onClick={handleAddToOffers}
                disabled={isProcessing || !selectedProduct}
              >
                {isProcessing ? "جاري الحفظ..." : "إضافة"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal تأكيد الإرجاع */}
      <ConfirmModal
        isOpen={showReturnModal}
        onClose={() => {
          setShowReturnModal(false);
          setOfferToReturn(null);
        }}
        title="تأكيد الإرجاع"
        message="هل أنت متأكد أنك تريد إرجاع هذا المنتج إلى المنتجات العادية؟"
        onConfirm={handleReturnFromOffers}
        confirmText="إرجاع"
        cancelText="إلغاء"
        type="warning"
      />

      {/* Modal تأكيد الحذف */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setOfferToDelete(null);
        }}
        title="تأكيد الحذف"
        message="هل أنت متأكد أنك تريد حذف هذا المنتج من العروض نهائياً؟"
        onConfirm={handleDeleteOffer}
        confirmText="حذف"
        cancelText="إلغاء"
        type="danger"
      />
    </div>
  );
}

export default function Offers() {
  return (
    <NotificationProvider>
      <OffersContent />
    </NotificationProvider>
  );
}

