// Service for closing day operations
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  writeBatch,
  Timestamp,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/app/firebase";

export const closeDayService = {
  async closeDay(shop, userName) {
    try {
      const today = new Date();
      const day = String(today.getDate()).padStart(2, "0");
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const year = today.getFullYear();
      const todayStr = `${day}/${month}/${year}`;

      // Get sales
      const salesQuery = query(
        collection(db, "dailySales"),
        where("shop", "==", shop)
      );
      const salesSnapshot = await getDocs(salesQuery);

      if (salesSnapshot.empty) {
        return { success: false, message: "لا يوجد عمليات لتقفيلها اليوم" };
      }

      // Get expenses
      const masrofatQuery = query(
        collection(db, "masrofat"),
        where("shop", "==", shop)
      );
      const masrofatSnapshot = await getDocs(masrofatQuery);

      // Calculate totals
      let totalSales = 0;
      const allSales = [];

      salesSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        allSales.push({ id: docSnap.id, ...data });
        totalSales += data.total || 0;
      });

      let totalMasrofat = 0;
      let returnedProfit = 0;
      let netMasrof = 0;
      const allMasrofat = [];

      masrofatSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        allMasrofat.push({ id: docSnap.id, ...data });

        const reason = data.reason;
        const masrofValue = data.masrof || 0;
        const isExcluded =
          reason === "فاتورة مرتجع" || reason === "مصروف سداد";

        // صافي المصروفات التي تؤثر على الربح (بدون فاتورة مرتجع / مصروف سداد)
        if (!isExcluded) {
          netMasrof += masrofValue;
        }

        if (data.date === todayStr) {
          if (reason === "فاتورة مرتجع") {
            returnedProfit += data.profit || 0;
          } else if (!isExcluded) {
            totalMasrofat += masrofValue;
          }
        }
      });

      // Batch operations
      const batch = writeBatch(db);

      // Move dailySales to reports
      for (const docSnap of salesSnapshot.docs) {
        const data = docSnap.data();
        const reportRef = doc(collection(db, "reports"));
        batch.set(reportRef, {
          ...data,
          closedBy: userName,
        });
        batch.delete(docSnap.ref);
      }

      // Save daily profit
      const profitData = {
        shop,
        date: todayStr,
        totalSales,
        totalMasrofat: Number(netMasrof),
        returnedProfit,
        createdAt: Timestamp.now(),
        closedBy: userName,
      };
      const profitRef = doc(collection(db, "dailyProfit"));
      batch.set(profitRef, profitData);

      // Delete today's expenses
      masrofatSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.date === todayStr) {
          batch.delete(docSnap.ref);
        }
      });

      // Helper function to calculate quantity
      const computeQty = (item) => {
        if (item.colors && Array.isArray(item.colors)) {
          let total = 0;
          item.colors.forEach((c) => {
            if (Array.isArray(c.sizes)) {
              c.sizes.forEach((s) => {
                total += Number(s.qty || 0);
              });
            } else if (c.quantity) {
              total += Number(c.quantity || 0);
            }
          });
          return total;
        }
        return Number(item.quantity || 0);
      };

      // Get last close day to get previous current (which becomes opening)
      let previousCurrent = 0;
      let lastCloseTime = null;
      try {
        const lastCloseQuery = query(
          collection(db, "closeDayHistory"),
          where("shop", "==", shop),
          orderBy("closedAtTimestamp", "desc"),
          limit(1)
        );
        const lastCloseSnapshot = await getDocs(lastCloseQuery);
        if (!lastCloseSnapshot.empty) {
          const lastCloseData = lastCloseSnapshot.docs[0].data();
          previousCurrent = lastCloseData.currentQty || 0;
          lastCloseTime = lastCloseData.closedAtTimestamp?.toDate
            ? lastCloseData.closedAtTimestamp.toDate().getTime()
            : (lastCloseData.closedAtTimestamp?.seconds || 0) * 1000;
        }
      } catch (err) {
        console.warn("Could not fetch last close day:", err);
      }

      // Get wared since last close
      let newWaredQtySinceLastClose = 0;
      try {
        const waredQuery = query(
          collection(db, "wared"),
          where("shop", "==", shop)
        );
        const waredSnapshot = await getDocs(waredQuery);
        
        waredSnapshot.forEach((docSnap) => {
          const item = docSnap.data();
          if (lastCloseTime) {
            // إذا كان هناك تقفيلة سابقة، نحسب الوارد منذ آخر تقفيلة
            const itemTime = item.date?.toDate
              ? item.date.toDate().getTime()
              : (item.date?.seconds || 0) * 1000;
            
            if (itemTime > lastCloseTime) {
              newWaredQtySinceLastClose += computeQty(item);
            }
          } else {
            // إذا لم تكن هناك تقفيلة سابقة، الوارد = كل الوارد
            newWaredQtySinceLastClose += computeQty(item);
          }
        });
      } catch (err) {
        console.warn("Could not fetch wared:", err);
      }

      // Calculate opening, sold, and current
      // استلام الشيفت = الحالي من آخر تقفيلة (هذا هو استلام الشيفت الجديد)
      const openingQty = previousCurrent;
      
      // الإجمالي الفعلي = استلام الشيفت + الوارد
      const actualTotalQty = openingQty + newWaredQtySinceLastClose;
      
      // حساب البيع
      let soldQty = 0;
      salesSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (Array.isArray(data.cart)) {
          data.cart.forEach((item) => {
            soldQty += Number(item.quantity || 0);
          });
        }
      });
      
      // الحالي = الإجمالي الفعلي - المبيع (هذا سيصبح استلام الشيفت الجديد في اليوم التالي)
      const currentQty = actualTotalQty - soldQty;

      // Create close day history
      const closeRef = doc(collection(db, "closeDayHistory"));
      batch.set(closeRef, {
        shop,
        closedBy: userName,
        closedAt: todayStr,
        closedAtTimestamp: Timestamp.now(),
        sales: allSales,
        masrofat: allMasrofat,
        openingQty, // الفتح
        soldQty, // البيع
        currentQty, // الحالي (سيصبح الفتح الجديد)
      });

      await batch.commit();

      return { success: true, message: "تم تقفيل اليوم بنجاح" };
    } catch (error) {
      console.error("Error closing day:", error);
      return { success: false, error };
    }
  },
};
