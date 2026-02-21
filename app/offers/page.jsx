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
import { PERMISSIONS } from "@/constants/config";
import { FaPlus, FaTrash, FaUndo } from "react-icons/fa";
import { CiSearch } from "react-icons/ci";
import { MdDriveFileRenameOutline } from "react-icons/md";
import { GiMoneyStack } from "react-icons/gi";

function OffersContent() {
  const { success, error: showError } = useNotification();
  const router = useRouter();
  const [auth, setAuth] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState([]);
  const [products, setProducts] = useState([]);
  const [filteredOffers, setFilteredOffers] = useState([]);
  const [searchCode, setSearchCode] = useState("");
  const [filterSection, setFilterSection] = useState("الكل");
  const [totalBuy, setTotalBuy] = useState(0);
  const [totalSell, setTotalSell] = useState(0);
  const [finaltotal, setFinalTotal] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
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
    if (typeof window !== "undefined") {
      const userName = localStorage.getItem("userName");
      if (!userName) {
        router.push("/");
        return;
      }

      const hasAccess = PERMISSIONS.MANAGE_OFFERS(userName);
      setIsAdmin(hasAccess);
      setAuth(true);
      setLoading(false);
    }
  }, [router]);

  // جلب منتجات العروض
  useEffect(() => {
    if (!shop) return;

    const q = query(collection(db, "offers"), where("shop", "==", shop));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          ...doc.data(),
          // id الحقيقي من Firestore بغض النظر عن أي id محفوظ جوه الداتا
          id: doc.id,
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
          ...doc.data(),
          // دايمًا استخدم id من المستند نفسه
          id: doc.id,
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

      // لا نخزن id القديم الخاص بالمنتج الأصلي داخل مستند العروض
      delete offerProduct.id;

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
      let offerRef = null;
      let offerSnap = null;
      let offerData = null;

      // محاولة البحث بالـ id أولاً
      if (offerToReturn.id) {
        offerRef = doc(db, "offers", offerToReturn.id);
        offerSnap = await getDoc(offerRef);
        
        if (offerSnap.exists()) {
          offerData = offerSnap.data();
        }
      }

      // إذا لم يتم العثور عليه بالـ id، البحث بالكود
      if (!offerData && offerToReturn.code) {
        const q = query(
          collection(db, "offers"),
          where("code", "==", offerToReturn.code),
          where("shop", "==", shop)
        );
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const docSnap = querySnapshot.docs[0];
          offerRef = docSnap.ref;
          offerData = docSnap.data();
        }
      }

      if (!offerData) {
        showError("المنتج غير موجود في العروض");
        setIsProcessing(false);
        return;
      }

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
      // لا ننقل id الخاص بمستند العرض إلى المنتجات
      delete returnProduct.id;

      // إضافة المنتج في lacosteProducts
      await addDoc(collection(db, "lacosteProducts"), returnProduct);

      // حذف من offers - يجب أن يكون offerRef موجوداً الآن
      if (offerRef) {
        await deleteDoc(offerRef);
      } else {
        // كحل احتياطي، البحث بالكود وحذفه
        const q = query(
          collection(db, "offers"),
          where("code", "==", offerToReturn.code),
          where("shop", "==", shop)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          await deleteDoc(querySnapshot.docs[0].ref);
        } else {
          console.warn("لم يتم العثور على المنتج في offers للحذف");
        }
      }

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
      let offerRef = null;

      // محاولة البحث بالـ id أولاً
      if (offerToDelete.id) {
        const offerDocRef = doc(db, "offers", offerToDelete.id);
        const offerSnap = await getDoc(offerDocRef);
        
        if (offerSnap.exists()) {
          offerRef = offerDocRef;
        }
      }

      // إذا لم يتم العثور عليه بالـ id، البحث بالكود
      if (!offerRef && offerToDelete.code) {
        const q = query(
          collection(db, "offers"),
          where("code", "==", offerToDelete.code),
          where("shop", "==", shop)
        );
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          offerRef = querySnapshot.docs[0].ref;
        }
      }

      if (!offerRef) {
        showError("المنتج غير موجود في العروض");
        setIsProcessing(false);
        return;
      }

      await deleteDoc(offerRef);
      success("✅ تم حذف المنتج من العروض بنجاح");
      setShowDeleteModal(false);
      setOfferToDelete(null);
    } catch (error) {
      console.error("Error deleting offer:", error);
      showError("حدث خطأ أثناء حذف المنتج");
    } finally {
      setIsProcessing(false);
    }
  }, [offerToDelete, shop, success, showError]);

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

  // Filtered offers using useMemo
  const filteredOffersMemo = useMemo(() => {
    let filtered = offers;

    if (searchCode.trim()) {
      const term = searchCode.trim().toLowerCase();
      filtered = filtered.filter((o) => {
        const codeStr = o.code?.toString().toLowerCase() || "";
        const nameStr = (o.name || "").toLowerCase();
        const merchantStr = (o.merchantName || "").toLowerCase();
        return (
          codeStr.includes(term) ||
          nameStr.includes(term) ||
          merchantStr.includes(term)
        );
      });
    }

    // Filter by section
    if (filterSection && filterSection !== "الكل") {
      filtered = filtered.filter((o) => o.section === filterSection);
    }

    return filtered;
  }, [offers, searchCode, filterSection]);

  // Calculate totals using useMemo
  const totals = useMemo(() => {
    let totalQty = 0;
    let totalBuyAmount = 0;
    let totalSellAmount = 0;
    let finalTotalAmount = 0;

    filteredOffersMemo.forEach((offer) => {
      const offerQty = computeProductQuantity(offer);
      totalQty += offerQty;
      totalBuyAmount += (offer.buyPrice || 0) * offerQty;
      totalSellAmount += (offer.sellPrice || 0) * offerQty;
      finalTotalAmount += (offer.finalPrice || 0) * offerQty;
    });

    return {
      totalQty,
      totalBuy: totalBuyAmount,
      totalSell: totalSellAmount,
      finalTotal: finalTotalAmount,
    };
  }, [filteredOffersMemo, computeProductQuantity]);

  // Update state from memoized values
  useEffect(() => {
    setFilteredOffers(filteredOffersMemo);
    setTotalProducts(totals.totalQty);
    setTotalBuy(totals.totalBuy);
    setTotalSell(totals.totalSell);
    setFinalTotal(totals.finalTotal);
  }, [filteredOffersMemo, totals]);

  // Get unique sections from offers
  const uniqueSections = useMemo(() => {
    const sections = new Set();
    offers.forEach((offer) => {
      if (offer.section) sections.add(offer.section);
    });
    return Array.from(sections).sort();
  }, [offers]);

  if (loading) return <Loader />;
  if (!auth) return null;

  return (
    <div className={styles.offers}>
      <SideBar />
      <div className={styles.content}>
        <div className={styles.stockMenu}>
          {/* Header */}
          <div className={styles.menuHeader}>
            <h1 className={styles.menuTitle}>العروض</h1>
            <div className={styles.headerControls}>
              {/* Filter Dropdown */}
              <div className={styles.filterDropdown}>
                <select
                  value={filterSection}
                  onChange={(e) => setFilterSection(e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="الكل">الكل</option>
                  {uniqueSections.map((section) => (
                    <option key={section} value={section}>
                      {section}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Box */}
              <div className={styles.searchContainer}>
                <CiSearch className={styles.searchIcon} />
                <input
                  type="text"
                  list="codesList"
                  placeholder="بحث..."
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  className={styles.searchInput}
                />
                <datalist id="codesList">
                  {offers.map((o) => (
                    <option key={o.id} value={o.code} />
                  ))}
                </datalist>
              </div>

              {/* Add Button */}
              {isAdmin && (
                <button
                  className={styles.addStockBtn}
                  onClick={() => {
                    setShowAddModal(true);
                    setSearchCode("");
                    setSelectedProduct(null);
                  }}
                >
                  <FaPlus className={styles.addIcon} />
                  <span>إضافة منتج للعروض</span>
                </button>
              )}
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
              <span className={styles.summaryLabel}>إجمالي العروض</span>
              <span className={styles.summaryValue}>
                {totalProducts} قطعة
              </span>
            </div>
          </div>

          {/* Offers Table */}
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
                {filteredOffers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className={styles.emptyCell}>
                      لا توجد عروض
                    </td>
                  </tr>
                ) : (
                  [...filteredOffers]
                    .sort((a, b) => Number(a.code) - Number(b.code))
                    .map((offer) => {
                      const colorsList = offer.colors || [];
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
                        <tr key={offer.id}>
                          <td className={styles.codeCell}>{offer.code || "-"}</td>
                          <td className={styles.nameCell}>
                            {offer.name || "-"}
                          </td>
                          <td className={styles.sectionCell}>
                            <span className={styles.sectionBadge}>
                              {offer.section || "-"}
                            </span>
                          </td>
                          <td>{offer.merchantName || "-"}</td>
                          <td className={styles.priceCell}>
                            {offer.buyPrice || 0} EGP
                          </td>
                          <td className={styles.priceCell}>
                            {offer.sellPrice || 0} EGP
                          </td>
                          <td className={styles.priceCell}>
                            {offer.finalPrice || 0} EGP
                          </td>
                          <td className={styles.stockCell}>
                            <span className={styles.stockBadge}>
                              {totalQ || offer.quantity || 0}
                            </span>
                          </td>
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

                                  const sizesDetails = c.sizes && c.sizes.length
                                    ? c.sizes.map(s => `${s.size}: ${s.qty}`).join(", ")
                                    : c.quantity ? `الكمية: ${c.quantity}` : "لا توجد مقاسات";

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
                                          {c.sizes && c.sizes.length > 0
                                            ? c.sizes.map((s) => (
                                                <div
                                                  key={s.size}
                                                  className={styles.tooltipSizeItem}
                                                >
                                                  <span className={styles.tooltipSizeName}>
                                                    {s.size}
                                                  </span>
                                                  <span className={styles.tooltipSizeQty}>
                                                    {s.qty}
                                                  </span>
                                                </div>
                                              ))
                                            : c.quantity && (
                                                <div className={styles.tooltipSizeItem}>
                                                  <span className={styles.tooltipSizeName}>
                                                    الكمية
                                                  </span>
                                                  <span className={styles.tooltipSizeQty}>
                                                    {c.quantity}
                                                  </span>
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
                          <td className={styles.actionsCell}>
                            {isAdmin && (
                              <>
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
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
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

