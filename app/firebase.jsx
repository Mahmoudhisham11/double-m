// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAls-bL5cwjeVKL9VEzqq0a32GkaZm_hrU",
  authDomain: "kofta-27944.firebaseapp.com",
  projectId: "kofta-27944",
  storageBucket: "kofta-27944.firebasestorage.app",
  messagingSenderId: "508712082139",
  appId: "1:508712082139:web:84b7f59181589aac63cafe"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Enable offline persistence
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === "failed-precondition") {
      // Multiple tabs open, persistence can only be enabled in one tab at a time.
      console.warn("Firebase persistence failed: Multiple tabs open");
    } else if (err.code === "unimplemented") {
      // The current browser does not support all of the features required
      console.warn("Firebase persistence not available in this browser");
    } else {
      console.error("Firebase persistence error:", err);
    }
  });
}