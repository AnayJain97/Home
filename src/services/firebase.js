import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAElRWFhZePVSr30yutnm-AvaXr-erashw",
  authDomain: "rpr-lending-borrowing.firebaseapp.com",
  projectId: "rpr-lending-borrowing",
  storageBucket: "rpr-lending-borrowing.firebasestorage.app",
  messagingSenderId: "418878681065",
  appId: "1:418878681065:web:1f7481aad8d3fd5a7b2578"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
