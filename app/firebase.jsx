// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {getFirestore} from "firebase/firestore"
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDaZhb98oR5RKBmZCApVRaRz3WhnQSU7Jc",
  authDomain: "snad-15c3c.firebaseapp.com",
  projectId: "snad-15c3c",
  storageBucket: "snad-15c3c.firebasestorage.app",
  messagingSenderId: "5426501490",
  appId: "1:5426501490:web:ccc1400a9ba60ca3286feb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app)