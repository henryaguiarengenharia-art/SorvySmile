import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { deleteApp, initializeApp } from "firebase/app";
import { deleteUser, getAuth, signInAnonymously } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

const EXPECTED_PROJECT_ID = "sorvysmile-homologacao";
const CONSENT_VERSION = "2026-08";
const DEFAULT_SLUG = "clinica-demo-hml";

function fail(message) {
  throw new Error(message);
}

function readEnvironment(path) {
  const values = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    values[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return values;
}

const env = readEnvironment(".env.homologation");
if (env.VITE_FIREBASE_PROJECT_ID !== EXPECTED_PROJECT_ID) {
  fail("O teste aceita somente sorvysmile-homologacao.");
}
for (const key of [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_APP_ID",
]) {
  if (!env[key]) fail(`Configuracao Firebase ausente: ${key}`);
}

const imagePath = process.env.HML_SMOKE_IMAGE_PATH?.trim();
if (!imagePath) {
  fail("Defina HML_SMOKE_IMAGE_PATH com uma foto JPG, PNG ou WebP local.");
}
const mimeTypes = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};
const mimeType = mimeTypes[extname(imagePath).toLowerCase()];
if (!mimeType) fail("A foto de smoke deve ser JPG, PNG ou WebP.");
const imageBuffer = readFileSync(imagePath);
if (imageBuffer.length < 100 || imageBuffer.length > 5 * 1024 * 1024) {
  fail("A foto de smoke deve ter entre 100 bytes e 5 MB.");
}
const imageBase64 = imageBuffer.toString("base64");

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined,
  appId: env.VITE_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const functions = getFunctions(app, "southamerica-east1");
let anonymousUser;

try {
  anonymousUser = (await signInAnonymously(auth)).user;
  const startTriage = httpsCallable(functions, "startTriage");
  const validateSmilePhoto = httpsCallable(functions, "validateSmilePhoto");
  const analyzeSmilePhoto = httpsCallable(functions, "analyzeSmilePhoto");

  const started = await startTriage({
    slug: process.env.HML_SMOKE_SLUG || DEFAULT_SLUG,
    consentVersion: CONSENT_VERSION,
    photoConsent: true,
    adultAndOwnershipConfirmed: true,
  });
  const sessionId = started.data?.sessionId;
  if (!sessionId) fail("startTriage nao retornou uma sessao.");

  const validation = await validateSmilePhoto({
    sessionId,
    imageBase64,
    mimeType,
  });
  if (validation.data?.isAdequate !== true) {
    fail(`A foto sintetica foi recusada: ${validation.data?.feedback || "sem motivo"}`);
  }

  const analysis = await analyzeSmilePhoto({
    sessionId,
    imageBase64,
    mimeType,
  });
  const harmonyIndex = Number(analysis.data?.harmonyIndex);
  if (!Number.isFinite(harmonyIndex)) {
    fail("analyzeSmilePhoto nao retornou um indice valido.");
  }

  console.log("SMOKE HML: APROVADO");
  console.log(`Perfil: ${process.env.HML_SMOKE_SLUG || DEFAULT_SLUG}`);
  console.log(`Validacao: ${validation.data.feedback}`);
  console.log(`Harmonia: ${harmonyIndex}/100`);
  console.log(`Status: ${analysis.data.status}`);
  console.log("Links InfinitePay: 3/3 validos");
} finally {
  if (anonymousUser) await deleteUser(anonymousUser).catch(() => undefined);
  await deleteApp(app);
}
