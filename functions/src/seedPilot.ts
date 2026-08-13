import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { normalizePlan, PLANS } from "./plans.js";
import { requireSeedProject } from "./seedProject.js";
import { slugSchema } from "./validation.js";

const seedProjectId = requireSeedProject();
if (getApps().length === 0) initializeApp({ projectId: seedProjectId });

const email = process.env.PILOT_EMAIL?.trim().toLowerCase();
const password = process.env.PILOT_PASSWORD;
const name = process.env.PILOT_NAME?.trim() || "Clínica Saúde Integrada BH";
const whatsapp = process.env.PILOT_WHATSAPP?.replace(/\D/g, "");
const requestedPlan = process.env.PILOT_PLAN?.trim();
const slug = slugSchema.parse(
  process.env.PILOT_SLUG?.trim() || "clinica-saude-integrada-bh",
);

if (
  !email
  || !password
  || password.length < 10
  || !whatsapp
  || whatsapp.length < 10
  || !requestedPlan
) {
  throw new Error(
    "Defina PILOT_EMAIL, PILOT_PASSWORD (10+ caracteres), PILOT_WHATSAPP e PILOT_PLAN antes de executar.",
  );
}
const plan = normalizePlan(requestedPlan);
const accessRole = plan === "network" ? "clinic" : "professional";
const ownerType = plan === "network" ? "clinic" : "dentist";

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

const accountId = `pilot_${slug}`;
const professionalId = `pro_${slug}`;
const now = Date.now();
const batch = db.batch();

batch.set(
  db.doc(`users/${user.uid}`),
  {
    uid: user.uid,
    email,
    role: accessRole,
    accountId,
    professionalId,
    slug,
    status: "active",
    createdAtMs: now,
    updatedAtMs: now,
  },
  { merge: true },
);
batch.set(
  db.doc(`accounts/${accountId}`),
  {
    id: accountId,
    ownerUid: user.uid,
    professionalId,
    slug,
    accountName: name,
    plan,
    tier: plan,
    requestedPlan: plan,
    requestedPrice: PLANS[plan].price,
    status: "active",
    isActive: true,
    monthlyLeadLimit: PLANS[plan].monthlyLeadLimit,
    ownerType,
    seatsTotal: PLANS[plan].includedSeats,
    seatsUsed: 1,
    extraSeatPrice: PLANS[plan].extraSeatPrice,
    paymentProvider: "legacy_migration",
    paymentStatus: "confirmed",
    paymentConfirmedAtMs: now,
    paymentConfirmedBy: "seed:pilot",
    activatedAtMs: now,
    activatedBy: "seed:pilot",
    activatedPlan: plan,
    activatedPrice: PLANS[plan].price,
    renewAtMs: now + 30 * 24 * 60 * 60 * 1000,
    checkoutEmail: email,
    checkoutWhatsapp: whatsapp,
    createdAtMs: now,
    updatedAtMs: now,
  },
  { merge: true },
);
batch.set(
  db.doc(`professionals/${professionalId}`),
  {
    id: professionalId,
    accountId,
    ownerUid: user.uid,
    name,
    email,
    whatsapp,
    plan,
    role: "dentist",
    publicSlug: slug,
    isActive: true,
    createdAt: now,
    createdAtMs: now,
    updatedAtMs: now,
  },
  { merge: true },
);
batch.set(
  db.doc(`publicProfiles/${slug}`),
  {
    slug,
    accountId,
    professionalId,
    name,
    whatsapp,
    plan,
    ownerType,
    active: true,
    createdAtMs: now,
    updatedAtMs: now,
  },
  { merge: true },
);
await batch.commit();
await auth.setCustomUserClaims(user.uid, {
  role: accessRole,
  accountId,
  professionalId,
  accountStatus: "active",
});

console.log(`Cliente piloto configurado: ${slug} (${plan}).`);
