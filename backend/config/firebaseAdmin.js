import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT
);

const app = initializeApp({
  credential: cert(serviceAccount),
});

export const adminAuth = getAuth(app);

export default app;