"use client";
import { useState, useEffect, useCallback } from "react";
import {
  doc,
  onSnapshot,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/app/firebase";

// الأقسام الافتراضية (تُستخدم لو لسه مفيش أقسام محفوظة للمحل)
export const DEFAULT_SECTIONS = [
  "جينز",
  "تيشيرت",
  "شروال",
  "جاكت",
  "قميص",
  "ترينج",
  "اندر شيرت",
];

/**
 * إدارة أقسام المنتجات (جاكت، بنطلون، تيشيرت ...)
 * محفوظة في Firestore: sections/{shop} => { shop, list: [...] }
 */
export function useSections(shop) {
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shop) {
      setLoading(false);
      return;
    }
    const ref = doc(db, "sections", shop);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        const list = snap.exists() ? snap.data().list : null;
        setSections(Array.isArray(list) ? list : DEFAULT_SECTIONS);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching sections:", err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [shop]);

  const saveList = useCallback(
    async (list) => {
      await setDoc(doc(db, "sections", shop), { shop, list }, { merge: true });
    },
    [shop]
  );

  const addSection = useCallback(
    async (name) => {
      const clean = (name || "").trim();
      if (!clean) throw new Error("يرجى إدخال اسم القسم");
      if (sections.includes(clean)) throw new Error("هذا القسم موجود بالفعل");
      await saveList([...sections, clean]);
    },
    [sections, saveList]
  );

  // تعديل اسم قسم + تحديث كل المنتجات والعروض اللي على القسم القديم
  const renameSection = useCallback(
    async (oldName, newName) => {
      const clean = (newName || "").trim();
      if (!clean) throw new Error("يرجى إدخال اسم القسم");
      if (clean === oldName) return;
      if (sections.includes(clean)) throw new Error("هذا القسم موجود بالفعل");

      await saveList(sections.map((s) => (s === oldName ? clean : s)));

      for (const col of ["lacosteProducts", "offers"]) {
        const snap = await getDocs(
          query(
            collection(db, col),
            where("shop", "==", shop),
            where("section", "==", oldName)
          )
        );
        // Firestore batch حدّه 500 عملية
        let batch = writeBatch(db);
        let count = 0;
        for (const d of snap.docs) {
          batch.update(d.ref, { section: clean });
          count++;
          if (count === 450) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        if (count > 0) await batch.commit();
      }
    },
    [sections, saveList, shop]
  );

  const deleteSection = useCallback(
    async (name) => {
      await saveList(sections.filter((s) => s !== name));
    },
    [sections, saveList]
  );

  return { sections, loading, addSection, renameSection, deleteSection };
}
