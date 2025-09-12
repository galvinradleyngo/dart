import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// You can safely expose this config in web apps; do NOT commit service account files.
export const firebaseConfig = {
  apiKey: "AIzaSyC-WLjFyn9HVBtOMYm4_v9IK58-W-oJRUE",
  authDomain: "dart-ed2ab.firebaseapp.com",
  projectId: "dart-ed2ab",
  storageBucket: "dart-ed2ab.firebasestorage.app",
  messagingSenderId: "812711016664",
  appId: "1:812711016664:web:57d147e389d1f76b157fad"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
