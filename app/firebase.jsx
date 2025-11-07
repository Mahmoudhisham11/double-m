// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {getFirestore} from "firebase/firestore"
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

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
export const db = getFirestore(app)