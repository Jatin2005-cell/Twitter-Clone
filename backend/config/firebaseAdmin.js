import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";

const serviceAccount = JSON.parse(
  fs.readFileSync(new URL("./serviceAccountKey.json", import.meta.url), "utf8")
);

const app = initializeApp({
  credential: cert(serviceAccount),
});

export const adminAuth = getAuth(app);
export default app;