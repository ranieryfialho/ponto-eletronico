import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBeGKTLlurkU9VZp3BjW2p6En1BZiuMWgg",
  authDomain: "ponto-eletronico-senior-81a53.firebaseapp.com",
  projectId: "ponto-eletronico-senior-81a53",
  storageBucket: "ponto-eletronico-senior-81a53.firebasestorage.app",
  messagingSenderId: "219101690961",
  appId: "1:219101690961:web:01cb4e5ce059a85dc34c70"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };