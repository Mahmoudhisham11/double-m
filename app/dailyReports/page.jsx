"use client";
import SideBar from "@/components/SideBar/page";
import styles from "./styles.module.css";
import { useEffect, useState, useMemo, useCallback } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import Loader from "@/components/Loader/Loader";

export default function DailyReports() {
  const [products, setProducts] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wared, setWared] = useState([]);
  const [sales, setSales] = useState([]);
  const [lastCloseDay, setLastCloseDay] = useState(null);

  // دالة حساب كمية منتج واحد (حسب الألوان والمقاسات)
  const computeTotalQtyFromColors = useCallback((colorsArr) => {
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
  }, []);

  // دالة حساب إجمالي كل المنتجات بعد الفلترة
  const computeTotalProducts = useCallback((arr) => {
    let total = 0;
    arr.forEach((product) => {
      if (product.colors && product.colors.length) {
        total += computeTotalQtyFromColors(product.colors);
      } else {
        total += Number(product.quantity || 0);
      }
    });
    return total;
  }, [computeTotalQtyFromColors]);

  // إنشاء خريطة للمنتجات (code -> section) لمعرفة قسم كل منتج
  const productSectionMap = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      if (p.code) {
        map.set(p.code.toString(), p.section || "");
      }
    });
    return map;
  }, [products]);

  // فلترة المنتجات حسب القسم
  const filteredProducts = useMemo(() => {
    if (!selectedSection) {
      return products;
    }
    return products.filter((p) => p.section === selectedSection);
  }, [products, selectedSection]);

  // حساب إجمالي الكمية
  const totalQty = useMemo(() => {
    return computeTotalProducts(filteredProducts);
  }, [filteredProducts, computeTotalProducts]);

  // حساب الوارد الجديد منذ آخر تقفيلة (حسب القسم المحدد)
  const newWaredQty = useMemo(() => {
    let total = 0;
    
    if (lastCloseDay?.closedAtTimestamp) {
      const lastCloseTime = lastCloseDay.closedAtTimestamp?.toDate
        ? lastCloseDay.closedAtTimestamp.toDate().getTime()
        : (lastCloseDay.closedAtTimestamp?.seconds || 0) * 1000;
      
      wared.forEach((item) => {
        const itemSection = item.section || productSectionMap.get(item.code?.toString()) || "";
        
        // إذا كان هناك قسم محدد، نفلتر حسب القسم
        if (selectedSection && itemSection !== selectedSection) {
          return;
        }
        
        const itemTime = item.date?.toDate
          ? item.date.toDate().getTime()
          : (item.date?.seconds || 0) * 1000;
        
        if (itemTime > lastCloseTime) {
          const qty = item.colors?.length
            ? computeTotalQtyFromColors(item.colors)
            : Number(item.quantity || 0);
          total += qty;
        }
      });
    } else {
      // إذا لم تكن هناك تقفيلة سابقة، نجمع كل الوارد (حسب القسم المحدد)
      wared.forEach((item) => {
        const itemSection = item.section || productSectionMap.get(item.code?.toString()) || "";
        
        // إذا كان هناك قسم محدد، نفلتر حسب القسم
        if (selectedSection && itemSection !== selectedSection) {
          return;
        }
        
        const qty = item.colors?.length
          ? computeTotalQtyFromColors(item.colors)
          : Number(item.quantity || 0);
        total += qty;
      });
    }
    
    return total;
  }, [lastCloseDay, wared, selectedSection, productSectionMap, computeTotalQtyFromColors]);

  // حساب استلام الشيفت: من آخر تقفيلة فقط (يجب أن يبقى ثابتاً حتى إغلاق اليوم)
  const openingQty = useMemo(() => {
    // إذا كان هناك آخر تقفيلة، نستخدم الحالي المحفوظ كاستلام شيفت (ثابت)
    if (lastCloseDay?.currentQty !== undefined && lastCloseDay?.currentQty !== null) {
      if (selectedSection) {
        // إذا كان هناك قسم محدد، نحتاج لحساب استلام الشيفت للقسم
        // لكن بما أننا لا نحفظ الحالي لكل قسم في التقفيلة، سنستخدم طريقة تقريبية
        // سنحسب: استلام الشيفت = (المنتجات الحالية + المبيعات منذ آخر تقفيلة) - الوارد
        const currentProductsQty = computeTotalProducts(
          products.filter((p) => p.section === selectedSection)
        );
        
        // حساب المبيعات من هذا القسم منذ آخر تقفيلة
        let soldSinceLastClose = 0;
        if (lastCloseDay?.closedAtTimestamp) {
          const lastCloseTime = lastCloseDay.closedAtTimestamp?.toDate
            ? lastCloseDay.closedAtTimestamp.toDate().getTime()
            : (lastCloseDay.closedAtTimestamp?.seconds || 0) * 1000;
          
          sales.forEach((sale) => {
            const saleTime = sale.date?.toDate
              ? sale.date.toDate().getTime()
              : (sale.date?.seconds || 0) * 1000;
            
            if (saleTime > lastCloseTime && Array.isArray(sale.cart)) {
              sale.cart.forEach((item) => {
                const itemSection = item.section || productSectionMap.get(item.code?.toString()) || "";
                if (itemSection === selectedSection) {
                  soldSinceLastClose += Number(item.quantity || 0);
                }
              });
            }
          });
        }
        
        // استلام الشيفت = (المنتجات الحالية + المبيعات) - الوارد
        // هذا يعطينا استلام الشيفت الثابت (لأن المبيعات والوارد ثابتان)
        return (currentProductsQty + soldSinceLastClose) - newWaredQty;
      } else {
        // استلام الشيفت = الحالي من آخر تقفيلة (هذا هو استلام الشيفت الجديد - ثابت)
        return lastCloseDay.currentQty;
      }
    } else {
      // إذا لم تكن هناك تقفيلة سابقة، استلام الشيفت = (المنتجات الحالية + المبيعات) - الوارد
      // هذا يضمن أن استلام الشيفت يبقى ثابتاً حتى عند البيع
      let currentProductsQty = 0;
      if (selectedSection) {
        currentProductsQty = computeTotalProducts(
          products.filter((p) => p.section === selectedSection)
        );
      } else {
        currentProductsQty = computeTotalProducts(products);
      }
      
      // حساب المبيعات الكلية (من بداية اليوم)
      let totalSold = 0;
      sales.forEach((sale) => {
        if (Array.isArray(sale.cart)) {
          sale.cart.forEach((item) => {
            if (selectedSection) {
              const itemSection = item.section || productSectionMap.get(item.code?.toString()) || "";
              if (itemSection === selectedSection) {
                totalSold += Number(item.quantity || 0);
              }
            } else {
              totalSold += Number(item.quantity || 0);
            }
          });
        }
      });
      
      // استلام الشيفت = (المنتجات الحالية + المبيعات) - الوارد
      // هذا يضمن أن استلام الشيفت يبقى ثابتاً
      return (currentProductsQty + totalSold) - newWaredQty;
    }
  }, [lastCloseDay, selectedSection, products, newWaredQty, sales, productSectionMap, computeTotalProducts]);

  // حساب الإجمالي الفعلي: استلام الشيفت + الوارد (حسب القسم المحدد)
  const actualTotalQty = useMemo(() => {
    // الإجمالي الفعلي = استلام الشيفت + الوارد
    return openingQty + newWaredQty;
  }, [openingQty, newWaredQty]);

  // حساب البيع: إجمالي القطع المباعة من dailySales (حسب القسم المحدد)
  const soldQty = useMemo(() => {
    let total = 0;
    sales.forEach((sale) => {
      if (Array.isArray(sale.cart)) {
        sale.cart.forEach((item) => {
          // إذا كان هناك قسم محدد، نفلتر حسب القسم
          if (selectedSection) {
            const itemSection = item.section || productSectionMap.get(item.code?.toString()) || "";
            if (itemSection === selectedSection) {
              total += Number(item.quantity || 0);
            }
          } else {
            total += Number(item.quantity || 0);
          }
        });
      }
    });
    
    return total;
  }, [sales, selectedSection, productSectionMap]);

  // حساب الحالي: الإجمالي الفعلي - المبيع (وليس استلام الشيفت - المبيع)
  const currentQty = useMemo(() => {
    return actualTotalQty - soldQty;
  }, [actualTotalQty, soldQty]);


  // جلب آخر تقفيلة
  useEffect(() => {
    const shop = localStorage.getItem("shop");
    if (!shop) return;

    const fetchLastCloseDay = async () => {
      try {
        let q = query(
          collection(db, "closeDayHistory"),
          where("shop", "==", shop),
          orderBy("closedAtTimestamp", "desc"),
          limit(1)
        );
        
        let snapshot;
        try {
          snapshot = await getDocs(q);
        } catch (orderByError) {
          console.warn("orderBy failed, trying without orderBy:", orderByError);
          q = query(
            collection(db, "closeDayHistory"),
            where("shop", "==", shop)
          );
          snapshot = await getDocs(q);
          
          if (!snapshot.empty) {
            const docs = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            
            docs.sort((a, b) => {
              const ta = a.closedAtTimestamp?.toDate
                ? a.closedAtTimestamp.toDate().getTime()
                : (a.closedAtTimestamp?.seconds || 0) * 1000;
              const tb = b.closedAtTimestamp?.toDate
                ? b.closedAtTimestamp.toDate().getTime()
                : (b.closedAtTimestamp?.seconds || 0) * 1000;
              return tb - ta;
            });
            
            if (docs.length > 0) {
              setLastCloseDay(docs[0]);
              return;
            }
          }
        }
        
        if (!snapshot.empty) {
          const lastClose = {
            id: snapshot.docs[0].id,
            ...snapshot.docs[0].data(),
          };
          setLastCloseDay(lastClose);
        }
      } catch (err) {
        console.error("Error fetching last close day:", err);
      }
    };

    fetchLastCloseDay();
  }, []);

  // جلب الوارد
  useEffect(() => {
    const shop = localStorage.getItem("shop");
    if (!shop) return;

    const q = query(
      collection(db, "wared"),
      where("shop", "==", shop)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          setWared(data);
        } catch (err) {
          console.error("Error processing wared data:", err);
        }
      },
      (err) => {
        console.error("Error fetching wared:", err);
      }
    );

    return () => unsubscribe();
  }, []);

  // جلب المبيعات من dailySales
  useEffect(() => {
    const shop = localStorage.getItem("shop");
    if (!shop) return;

    const q = query(
      collection(db, "dailySales"),
      where("shop", "==", shop)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          setSales(data);
        } catch (err) {
          console.error("Error processing sales data:", err);
        }
      },
      (err) => {
        console.error("Error fetching sales:", err);
      }
    );

    return () => unsubscribe();
  }, []);

  // جلب المنتجات
  useEffect(() => {
    const shop = localStorage.getItem("shop");
    if (!shop) {
      setError("لم يتم العثور على المتجر");
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "lacosteProducts"),
      where("shop", "==", shop),
      where("type", "==", "product")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          setProducts(data);
          setError(null);
        } catch (err) {
          console.error("Error processing data:", err);
          setError("حدث خطأ أثناء معالجة البيانات");
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error("Error fetching products:", err);
        setError("حدث خطأ أثناء جلب البيانات");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <Loader />;
  }

  if (error) {
    return (
      <div className={styles.dailyReports}>
        <SideBar />
        <div className={styles.content}>
          <div className={styles.errorState}>
            <p>❌ {error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dailyReports}>
      <SideBar />

      <div className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>جرد يومي</h2>
        </div>

        {/* Search Box */}
        <div className={styles.searchBox}>
          <div className={styles.inputContainer}>
            <label className={styles.sectionLabel}>البحث بالقسم:</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className={styles.sectionSelect}
            >
              <option value="">كل الأقسام</option>
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

        {/* Cards: استلام الشيفت، الوارد، إجمالي فعلي، البيع، الحالي */}
        <div className={styles.totalCardsContainer}>
          <div className={styles.totalCard}>
            <h3 className={styles.totalLabel}>استلام الشيفت</h3>
            <span className={styles.totalValue}>{openingQty}</span>
            <p className={styles.totalDescription}>
              (المنتجات الحالية - الوارد)
            </p>
          </div>
          
          <div className={styles.totalCard}>
            <h3 className={styles.totalLabel}>الوارد</h3>
            <span className={styles.totalValue}>{newWaredQty}</span>
            <p className={styles.totalDescription}>
              (الوارد الجديد منذ آخر تقفيلة)
            </p>
          </div>
          
          <div className={styles.totalCard}>
            <h3 className={styles.totalLabel}>إجمالي فعلي</h3>
            <span className={styles.totalValue}>{actualTotalQty}</span>
            <p className={styles.totalDescription}>
              (استلام الشيفت + الوارد)
            </p>
          </div>
          
          <div className={styles.totalCard}>
            <h3 className={styles.totalLabel}>البيع</h3>
            <span className={styles.totalValue}>{soldQty}</span>
            <p className={styles.totalDescription}>
              (إجمالي القطع المباعة اليوم)
            </p>
          </div>
          
          <div className={styles.totalCard}>
            <h3 className={styles.totalLabel}>الحالي</h3>
            <span className={styles.totalValue}>{currentQty}</span>
            <p className={styles.totalDescription}>
              (الإجمالي الفعلي - المبيع)
            </p>
          </div>
        </div>

        {/* Products Table */}
        <div className={styles.tableWrapper}>
          <h3 className={styles.tableTitle}>المنتجات</h3>
          <table className={styles.reportsTable}>
            <thead>
              <tr>
                <th>الكود</th>
                <th>الاسم</th>
                <th>الكمية</th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={3} className={styles.emptyCell}>
                    <div className={styles.emptyState}>
                      <p>❌ لا توجد منتجات</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const qty = p.colors?.length
                    ? computeTotalQtyFromColors(p.colors)
                    : Number(p.quantity || 0);

                  return (
                    <tr key={p.id}>
                      <td className={styles.codeCell}>{p.code || "-"}</td>
                      <td className={styles.nameCell}>{p.name || "-"}</td>
                      <td className={styles.quantityCell}>{qty}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
