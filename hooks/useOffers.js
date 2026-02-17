"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/app/firebase";

export function useOffers(shop) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!shop) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, "offers"), where("shop", "==", shop));

    const unsubscribe = onSnapshot(
      q,
      {
        includeMetadataChanges: false,
      },
      (snapshot) => {
        const isFromCache = snapshot.metadata.fromCache;

        const data = snapshot.docs.map((doc) => ({
          ...doc.data(),
          // تأكد أن id الحقيقي للمستند دائمًا هو doc.id
          id: doc.id,
        }));

        setOffers(data);
        setError(null);
        setLoading(false);

        if (isFromCache) {
          console.log("📦 Offers loaded from cache (offline)");
        } else {
          console.log("🌐 Offers loaded from server (online)");
        }
      },
      (err) => {
        console.error("Error fetching offers:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [shop]);

  const filterOffers = useCallback((searchCode, filterType = "all") => {
    return offers.filter((o) => {
      const search = searchCode.trim().toLowerCase();
      const matchCode =
        search === "" ||
        (o.code && o.code.toString().toLowerCase().includes(search));
      const matchType =
        filterType === "all"
          ? true
          : filterType === "phone"
          ? o.type === "phone"
          : o.type !== "phone";
      return matchCode && matchType;
    });
  }, [offers]);

  return {
    offers,
    loading,
    error,
    filterOffers,
  };
}

