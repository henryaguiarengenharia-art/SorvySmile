import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const args = process.argv.slice(2);

function option(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const projectId = option("--project", process.env.FIREBASE_PROJECT_ID || "sorvysmile");
const frontendEnvPath = path.resolve(root, option("--frontend-env", ".env.production"));
const functionsEnvPath = path.resolve(
  root,
  option("--functions-env", `functions/.env.${projectId}`),
);
const failures = [];
const passes = [];

function check(condition, message) {
  if (condition) passes.push(message);
  else failures.push(message);
}

function readFile(file, label) {
  if (!fs.existsSync(file)) {
    failures.push(`${label} ausente: ${path.relative(root, file)}`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

function parseEnv(content) {
  const values = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return values;
}

check(projectId === "sorvysmile", "projeto alvo é sorvysmile");

const frontend = parseEnv(readFile(frontendEnvPath, "Configuração do frontend"));
const functions = parseEnv(readFile(functionsEnvPath, "Configuração das Functions"));

for (const key of [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_APPCHECK_SITE_KEY",
  "VITE_PRIVACY_CONTACT_EMAIL",
]) {
  check(Boolean(frontend[key]), `frontend contém ${key}`);
}

check(frontend.VITE_FIREBASE_PROJECT_ID === projectId, "frontend aponta para produção");
check(
  frontend.VITE_FIREBASE_AUTH_DOMAIN === `${projectId}.firebaseapp.com`,
  "Auth Domain pertence à produção",
);
check(
  new Set([`${projectId}.appspot.com`, `${projectId}.firebasestorage.app`])
    .has(frontend.VITE_FIREBASE_STORAGE_BUCKET),
  "Storage Bucket pertence à produção",
);
check(frontend.VITE_USE_FIREBASE_EMULATORS !== "true", "emuladores estão desativados");
check(
  /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(frontend.VITE_PRIVACY_CONTACT_EMAIL || ""),
  "email público de privacidade é válido",
);
check(!frontend.VITE_GEMINI_API_KEY, "Gemini não está exposto no frontend");
check(!frontend.VITE_INFINITEPAY_SECRET, "InfinitePay não possui segredo no frontend");

check(functions.ENFORCE_APP_CHECK === "true", "App Check é obrigatório nas callables");
check(
  functions.INFINITEPAY_HANDLE === "henry-augusto-pinheiro",
  "handle InfinitePay está configurado",
);
check(
  functions.PUBLIC_APP_URL === "https://sorvysmile.web.app",
  "retorno do checkout aponta para o domínio oficial",
);
check(Boolean(functions.GEMINI_MODEL), "modelo Gemini está definido");

const firebaseConfig = JSON.parse(readFile(path.join(root, "firebase.json"), "firebase.json") || "{}");
check(Boolean(firebaseConfig.firestore?.rules), "deploy inclui regras do Firestore");
check(Boolean(firebaseConfig.firestore?.indexes), "deploy inclui índices do Firestore");
check(Boolean(firebaseConfig.storage?.rules), "deploy inclui regras do Storage");
check(Boolean(firebaseConfig.functions), "deploy inclui Cloud Functions");
check(Boolean(firebaseConfig.hosting), "deploy inclui Hosting");

const paymentSource = readFile(
  path.join(root, "functions/src/infinitePay.ts"),
  "Integração InfinitePay",
);
const functionEntry = readFile(
  path.join(root, "functions/src/index.ts"),
  "Entrypoint das Functions",
);
for (const contract of [
  "createInfinitePayCheckout",
  "confirmInfinitePayReturn",
  "infinitePayWebhook",
  "expirePaidSubscriptions",
]) {
  check(functionEntry.includes(`export const ${contract}`), `Function exporta ${contract}`);
}
check(paymentSource.includes("/payment_check"), "webhook reconfirma o pagamento no provedor");
check(paymentSource.includes("INFINITEPAY_AMOUNT_MISMATCH"), "backend bloqueia divergência de valor");
check(paymentSource.includes("paymentTransactions"), "transações possuem trava de reutilização");
check(paymentSource.includes('status: "PAID"'), "pedidos possuem processamento idempotente");

if (failures.length) {
  console.error("\nCHECKLIST DE PRODUÇÃO: REPROVADO\n");
  for (const message of failures) console.error(`- FALHA: ${message}`);
  console.error(`\n${passes.length} verificações aprovadas; ${failures.length} pendências.`);
  process.exit(1);
}

console.log("\nCHECKLIST DE PRODUÇÃO: CONFIGURAÇÃO APROVADA\n");
for (const message of passes) console.log(`- OK: ${message}`);
console.log(`\n${passes.length} verificações aprovadas.`);
