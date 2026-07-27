// ================================================================
//  firebase-config.js
//  ⚠️  COLE AQUI AS SUAS CREDENCIAIS DO FIREBASE
// ================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ⚠️ SUBSTITUA PELOS DADOS DO SEU PROJETO FIREBASE
// Firebase Console → ⚙️ Configurações → Seus apps → SDK Config
const firebaseConfig = {
  apiKey:            "AIzaSyDbCgbOdursvIws2QYqJdPAnqxZ6-uYC-U",
  authDomain:        "echoai-678a0.firebaseapp.com",
  projectId:         "echoai-678a0",
  storageBucket:     "echoai-678a0.firebasestorage.app",
  messagingSenderId: "441410426540",
  appId:             "1:441410426540:web:ac6297f042a7c841c17109"
};

const app = initializeApp(firebaseConfig);
export const db           = getFirestore(app);
export const auth         = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
