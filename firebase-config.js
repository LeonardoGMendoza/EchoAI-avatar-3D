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
  apiKey:            "COLE_SUA_API_KEY_AQUI",
  authDomain:        "echoai-678a0.firebaseapp.com",
  projectId:         "echoai-678a0",
  storageBucket:     "echoai-678a0.appspot.com",
  messagingSenderId: "COLE_SEU_SENDER_ID",
  appId:             "COLE_SEU_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db           = getFirestore(app);
export const auth         = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
