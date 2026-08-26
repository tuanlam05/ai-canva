import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyA1ZIcRxu0o6DGGCiNQ3Z9OMzZVcqsLr_U",
  authDomain: "ai-canva-8bd1d.firebaseapp.com",
  projectId: "ai-canva-8bd1d",
  storageBucket: "ai-canva-8bd1d.firebasestorage.app",
  messagingSenderId: "974926894968",
  appId: "1:974926894968:web:b38cb77a7075c5b6f25a8d"
};

const app = initializeApp(firebaseConfig);

// Use localStorage for Auth persistence instead of the default IndexedDB.
// This avoids conflicts between Auth's IndexedDB and Firestore's IndexedDB cache.
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(console.error);

export { auth };
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);
