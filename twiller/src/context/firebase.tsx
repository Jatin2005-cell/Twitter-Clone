import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBHkkV7M-0K9Zi_V3FVsOv9vJGCIwuCNNo",
  authDomain: "twiller-466de.firebaseapp.com",
  projectId: "twiller-466de",
  storageBucket: "twiller-466de.firebasestorage.app",
  messagingSenderId: "634562586716",
  appId: "1:634562586716:web:768576ab0ada9055b91e99",
  measurementId: "G-ZT3CK35NKV",
};

const app = initializeApp(firebaseConfig);

// ✅ Export auth
export const auth = getAuth(app);

// Analytics (optional)
if (typeof window !== "undefined") {
  isSupported().then((yes) => {
    if (yes) getAnalytics(app);
  });
}

export default app;