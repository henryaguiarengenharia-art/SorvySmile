#!/usr/bin/env bash
set -Eeuo pipefail

readonly EXPECTED_PROJECT_ID="sorvysmile-homologacao"
readonly PRODUCTION_PROJECT_ID="sorvysmile"
readonly ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
readonly FRONTEND_ENV_FILE="$ROOT_DIR/.env.homologation"
readonly FUNCTIONS_ENV_FILE="$ROOT_DIR/functions/.env.sorvysmile-homologacao"
readonly PREVIEW_CHANNEL_ID="migracao-smile"

fail() {
  printf 'Erro: %s\n' "$1" >&2
  exit 1
}

PROJECT_ID="$(printenv FIREBASE_PROJECT_ID 2>/dev/null || true)"
[[ -n "$PROJECT_ID" ]] || PROJECT_ID="$EXPECTED_PROJECT_ID"
[[ "$PROJECT_ID" != "$PRODUCTION_PROJECT_ID" ]] \
  || fail "O projeto de producao sorvysmile esta protegido."
[[ "$PROJECT_ID" == "$EXPECTED_PROJECT_ID" ]] \
  || fail "Este deploy aceita somente sorvysmile-homologacao."

case "$#" in
  0) ;;
  1)
    [[ "$1" == "--verify-only" ]] \
      || fail "Use sem argumentos ou somente com --verify-only."
    printf 'Protecao validada para %s. Nenhuma alteracao foi executada.\n' \
      "$PROJECT_ID"
    exit 0
    ;;
  *) fail "Use sem argumentos ou somente com --verify-only." ;;
esac

for command_name in gcloud node npm npx; do
  command -v "$command_name" >/dev/null \
    || fail "O comando $command_name nao esta disponivel."
done

cd "$ROOT_DIR"
ACTIVE_PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
[[ "$ACTIVE_PROJECT" == "$PROJECT_ID" ]] \
  || fail "O projeto ativo do gcloud nao e sorvysmile-homologacao."

RESOLVED_PROJECT_ID="$(
  gcloud projects describe "$PROJECT_ID" \
    --format='value(projectId)' 2>/dev/null || true
)"
[[ "$RESOLVED_PROJECT_ID" == "$EXPECTED_PROJECT_ID" ]] \
  || fail "A conta Google ativa nao possui acesso a homologacao."

BILLING_ENABLED="$(
  gcloud billing projects describe "$PROJECT_ID" \
    --format='value(billingEnabled)' 2>/dev/null || true
)"
[[ "$BILLING_ENABLED" == "True" || "$BILLING_ENABLED" == "true" ]] \
  || fail "A homologacao precisa estar no Blaze antes de publicar Functions."

[[ -f "$FRONTEND_ENV_FILE" ]] \
  || fail "Execute npm run setup:hml antes do deploy completo."

node - "$FRONTEND_ENV_FILE" "$PROJECT_ID" <<'NODE'
const fs = require("node:fs");
const [file, expectedProject] = process.argv.slice(2);
const values = {};

for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
  if (!line || line.trimStart().startsWith("#")) continue;
  const separator = line.indexOf("=");
  if (separator < 1) continue;
  values[line.slice(0, separator)] = line.slice(separator + 1);
}

const overrides = {
  VITE_PAYMENT_URL_LITE: process.env.HML_PAYMENT_URL_LITE,
  VITE_PAYMENT_URL_PRO: process.env.HML_PAYMENT_URL_PRO,
  VITE_PAYMENT_URL_NETWORK: process.env.HML_PAYMENT_URL_NETWORK,
  VITE_PRIVACY_CONTACT_EMAIL: process.env.HML_PRIVACY_CONTACT_EMAIL,
};
for (const [key, value] of Object.entries(overrides)) {
  if (value && value.trim()) values[key] = value.trim();
}
values.VITE_PAYMENT_URL_ELITE = values.VITE_PAYMENT_URL_NETWORK || "";

const firebaseKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
];
for (const key of firebaseKeys) {
  if (!values[key]) throw new Error("Configuracao Firebase ausente: " + key);
}
if (values.VITE_FIREBASE_PROJECT_ID !== expectedProject) {
  throw new Error("A configuracao do frontend nao pertence a homologacao.");
}

for (const key of [
  "VITE_PAYMENT_URL_LITE",
  "VITE_PAYMENT_URL_PRO",
]) {
  if (!values[key]) throw new Error("Configuracao publica ausente: " + key);
  const url = new URL(values[key]);
  if (url.protocol !== "https:" || url.hostname !== "invoice.infinitepay.io") {
    throw new Error(key + " deve apontar para invoice.infinitepay.io.");
  }
}
if (values.VITE_PAYMENT_URL_NETWORK) {
  const networkUrl = new URL(values.VITE_PAYMENT_URL_NETWORK);
  if (networkUrl.protocol !== "https:" || networkUrl.hostname !== "invoice.infinitepay.io") {
    throw new Error("VITE_PAYMENT_URL_NETWORK deve apontar para invoice.infinitepay.io.");
  }
}

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.VITE_PRIVACY_CONTACT_EMAIL || "")) {
  throw new Error("VITE_PRIVACY_CONTACT_EMAIL e obrigatorio e deve ser valido.");
}

const order = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_APPCHECK_SITE_KEY",
  "VITE_DEFAULT_PROFESSIONAL_SLUG",
  "VITE_USE_FIREBASE_EMULATORS",
  "VITE_PAYMENT_URL_LITE",
  "VITE_PAYMENT_URL_PRO",
  "VITE_PAYMENT_URL_NETWORK",
  "VITE_PAYMENT_URL_ELITE",
  "VITE_PRIVACY_CONTACT_EMAIL",
];
fs.writeFileSync(
  file,
  order.map((key) => key + "=" + (values[key] || "")).join("\n") + "\n",
);
NODE

printf 'Validando codigo, regras e dependencias...\n'
npm ci
npm --prefix functions ci
npm run test:all
npm run build:all
npm run test:rules
npm audit --omit=dev
npm --prefix functions audit --omit=dev

printf 'Habilitando APIs do backend somente na homologacao...\n'
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  cloudfunctions.googleapis.com \
  cloudscheduler.googleapis.com \
  eventarc.googleapis.com \
  generativelanguage.googleapis.com \
  pubsub.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  --project "$PROJECT_ID" \
  --quiet

gcloud secrets describe GEMINI_API_KEY \
  --project "$PROJECT_ID" >/dev/null 2>&1 \
  || fail "O secret GEMINI_API_KEY ainda nao foi criado na homologacao. Execute npm run repair:gemini:hml primeiro."

SECRET_VERSION="$(
  gcloud secrets versions list GEMINI_API_KEY \
    --project "$PROJECT_ID" \
    --filter='state=ENABLED' \
    --limit=1 \
    --format='value(name)' 2>/dev/null || true
)"
[[ -n "$SECRET_VERSION" ]] \
  || fail "GEMINI_API_KEY nao possui uma versao ativa. Execute npm run repair:gemini:hml primeiro."

PROJECT_NUMBER="$(
  gcloud projects describe "$PROJECT_ID" \
    --format='value(projectNumber)' 2>/dev/null || true
)"
[[ "$PROJECT_NUMBER" =~ ^[0-9]+$ ]] \
  || fail "Nao foi possivel identificar o numero do projeto de homologacao."
RUNTIME_SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

RUNTIME_IDENTITY_READY=false
for _ in {1..12}; do
  if gcloud iam service-accounts describe "$RUNTIME_SERVICE_ACCOUNT" \
    --project "$PROJECT_ID" >/dev/null 2>&1; then
    RUNTIME_IDENTITY_READY=true
    break
  fi
  sleep 5
done
[[ "$RUNTIME_IDENTITY_READY" == "true" ]] \
  || fail "A identidade de runtime das Functions ainda nao esta disponivel."

printf 'Autorizando somente a identidade de runtime a ler o secret Gemini...\n'
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --project "$PROJECT_ID" \
  --member "serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
  --role roles/secretmanager.secretAccessor \
  --quiet >/dev/null

node - "$FUNCTIONS_ENV_FILE" <<'NODE'
const fs = require("node:fs");
fs.writeFileSync(
  process.argv[2],
  [
    "ENFORCE_APP_CHECK=false",
    "GEMINI_MODEL=gemini-3.6-flash",
    "",
  ].join("\n"),
);
NODE

printf 'Configurando limpeza segura dos artefatos de Functions...\n'
npx --no-install firebase functions:artifacts:setpolicy \
  --location southamerica-east1 \
  --days 7 \
  --project "$PROJECT_ID" \
  --force

printf 'Publicando regras e indices somente em %s...\n' "$PROJECT_ID"
npx --no-install firebase deploy \
  --only firestore:rules,firestore:indexes,storage \
  --project "$PROJECT_ID" \
  --non-interactive

printf 'Publicando as Functions de IA primeiro...\n'
npx --no-install firebase deploy \
  --only functions:validateSmilePhoto,functions:analyzeSmilePhoto,functions:askBusinessAssistant \
  --project "$PROJECT_ID" \
  --non-interactive

printf 'Garantindo acesso HTTP às Functions callable de IA...\n'
for service_name in validatesmilephoto analyzesmilephoto askbusinessassistant; do
  gcloud run services add-iam-policy-binding "$service_name" \
    --region southamerica-east1 \
    --project "$PROJECT_ID" \
    --member=allUsers \
    --role=roles/run.invoker \
    --quiet >/dev/null
done

printf 'Publicando o primeiro lote das demais Functions...\n'
npx --no-install firebase deploy \
  --only functions:startTriage,functions:captureLead,functions:recordPatientConversionAction,functions:createPendingSubscription,functions:updateProfessionalProfile,functions:updateProfessionalByHq,functions:updateProfessionalSlug,functions:startProfessionalTrial,functions:archiveProfessional,functions:restoreProfessional,functions:setAccountStatus,functions:createTeamMember,functions:manageDailyPost,functions:getDailyPostAssignment,functions:recordDailyPostEvent,functions:getAssistantWorkspace,functions:resolveAssistantAction,functions:recordAssistantFeedback,functions:recordAssistantClientEvent \
  --project "$PROJECT_ID" \
  --non-interactive

printf 'Publicando o segundo lote das demais Functions...\n'
npx --no-install firebase deploy \
  --only functions:setTeamMemberStatus,functions:assignLead,functions:deleteLead,functions:getAssistantAdminSettings,functions:getAssistantAdminOverview,functions:updateAssistantSettings,functions:updateCustomAssistantProfile,functions:getProfessionalAssistantSettings,functions:updateProfessionalAssistantSettings,functions:publishScheduledDailyPosts,functions:assignDailyPostsHourly,functions:expireProfessionalTrials,functions:cleanupExpiredTriageSessions,functions:cleanupExpiredLeads,functions:cleanupStaleUsageReservations \
  --project "$PROJECT_ID" \
  --non-interactive

printf 'Garantindo acesso HTTP às novas Functions callable das assistentes...\n'
for service_name in \
  getassistantworkspace \
  resolveassistantaction \
  recordassistantfeedback \
  recordassistantclientevent \
  getassistantadminsettings \
  getassistantadminoverview \
  updateassistantsettings \
  updatecustomassistantprofile \
  getprofessionalassistantsettings \
  updateprofessionalassistantsettings; do
  gcloud run services add-iam-policy-binding "$service_name" \
    --region southamerica-east1 \
    --project "$PROJECT_ID" \
    --member=allUsers \
    --role=roles/run.invoker \
    --quiet >/dev/null
done

printf 'Criando ou atualizando a biblioteca idempotente de 60 Posts do Dia...\n'
TARGET_FIREBASE_PROJECT_ID="$PROJECT_ID" \
GOOGLE_CLOUD_PROJECT="$PROJECT_ID" \
GCLOUD_PROJECT="$PROJECT_ID" \
node functions/lib/seedDailyPostTemplates.js

printf 'Criando ou atualizando definições versionadas das assistentes...\n'
TARGET_FIREBASE_PROJECT_ID="$PROJECT_ID" \
GOOGLE_CLOUD_PROJECT="$PROJECT_ID" \
GCLOUD_PROJECT="$PROJECT_ID" \
node functions/lib/seedAssistantDefinitions.js

printf 'Compilando e publicando o frontend funcional da homologacao...\n'
npm run build -- --mode homologation
npx --no-install firebase hosting:channel:deploy "$PREVIEW_CHANNEL_ID" \
  --expires 30d \
  --project "$PROJECT_ID" \
  --non-interactive

printf '\nBackend e frontend da homologacao publicados com sucesso.\n'
printf 'App Check permanece desativado somente em %s para os testes.\n' \
  "$PROJECT_ID"
printf 'O projeto protegido %s nao foi alterado.\n' "$PRODUCTION_PROJECT_ID"
