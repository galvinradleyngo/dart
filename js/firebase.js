// firebase.js
export function initFirebase() {
  const { initializeApp, getAuth, getFirestore, GoogleAuthProvider } = window.firebaseSDK;
  const firebaseConfig = {
    apiKey: "AIzaSyC-WLjFyn9HVBtOMYm4_v9IK58-W-oJRUE",
    authDomain: "dart-ed2ab.firebaseapp.com",
    projectId: "dart-ed2ab",
    storageBucket: "dart-ed2ab.firebasestorage.app",
    messagingSenderId: "812711016664",
    appId: "1:812711016664:web:57d147e389d1f76b157fad"
  };
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const googleProvider = new GoogleAuthProvider();
  return { app, auth, db, googleProvider };
}
