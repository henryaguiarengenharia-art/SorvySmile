import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) initializeApp();

const email = process.env.HQ_EMAIL?.trim().toLowerCase();
const password = process.env.HQ_PASSWORD;
const name = process.env.HQ_NAME?.trim() || "Administração Sorvy";

if (!email || !password || password.length < 10) {
  throw new Error(
    "Defina HQ_EMAIL e HQ_PASSWORD com pelo menos 10 caracteres antes de executar.",
  );
}

const auth = getAuth();
const db = getFirestore();

let user;
try {
  user = await auth.getUserByEmail(email);
} catch (error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  if (code !== "auth/user-not-found") throw error;
  user = await auth.createUser({
    email,
    password,
    displayName: name,
  });
}

const userRef = db.doc(`users/${user.uid}`);
const existing = await userRef.get();
const existingRole = existing.data()?.role ?? user.customClaims?.role;
if (existingRole && existingRole !== "hq") {
  throw new Error(
    "Este email já pertence a um perfil profissional e não pode ser promovido automaticamente para HQ.",
  );
}

const now = Date.now();
await userRef.set(
  {
    uid: user.uid,
    email,
    name,
    role: "hq",
    status: "active",
    ...(existing.exists ? {} : { createdAtMs: now }),
    updatedAtMs: now,
  },
  { merge: true },
);
await auth.setCustomUserClaims(user.uid, { role: "hq" });

console.log(`Usuário HQ configurado: ${email}.`);
