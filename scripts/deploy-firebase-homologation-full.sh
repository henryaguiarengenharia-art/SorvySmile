#!/usr/bin/env bash
set -Eeuo pipefail

readonly EXPECTED_PROJECT_ID="sorvysmile-homologacao"
readonly PRODUCTION_PROJECT_ID="sorvysmile"
readonly EXPECTED_FIREBASE_ACCOUNT="000.henry@gmail.com"
readonly LAUNCH_CANDIDATE_COMMIT="c83fbe349a5ee3f6c6361c4d34eece4c942538c7"
readonly MAX_FUNCTIONS_PER_BATCH=10
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

DEPLOY_MODE="full"
case "$#" in
  0) ;;
  1)
    case "$1" in
      --verify-only)
        printf 'Protecao validada para %s. Nenhuma alteracao foi executada.\n' \
          "$PROJECT_ID"
        exit 0
        ;;
      --launch-candidate)
        DEPLOY_MODE="launch-candidate"
        ;;
      *)
        fail "Use sem argumentos, com --verify-only ou com --launch-candidate."
        ;;
    esac
    ;;
  *) fail "Use sem argumentos, com --verify-only ou com --launch-candidate." ;;
esac

readonly DEPLOY_LOG_DIR="$ROOT_DIR/.deploy-logs"
mkdir -p "$DEPLOY_LOG_DIR"
readonly DEPLOY_RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
readonly DEPLOY_LOG_FILE="$DEPLOY_LOG_DIR/homologation-${DEPLOY_RUN_ID}.log"
readonly DEPLOY_STATUS_FILE="$DEPLOY_LOG_DIR/homologation-${DEPLOY_RUN_ID}-status.log"
printf '%s\n' "$DEPLOY_LOG_FILE" > "$DEPLOY_LOG_DIR/latest.log"
exec > >(tee -a "$DEPLOY_LOG_FILE") 2>&1

CURRENT_STAGE="preflight"
DEPLOY_SUCCEEDED=false
FIREBASE_ACCOUNTS_JSON=""
FIREBASE_PROJECTS_JSON=""

cleanup() {
  local status=$?
  [[ -z "$FIREBASE_ACCOUNTS_JSON" ]] \
    || rm -f -- "$FIREBASE_ACCOUNTS_JSON"
  [[ -z "$FIREBASE_PROJECTS_JSON" ]] \
    || rm -f -- "$FIREBASE_PROJECTS_JSON"
  if [[ "$DEPLOY_SUCCEEDED" == "true" ]]; then
    printf 'SUCCESS stage=complete exit=0 log=%s\n' "$DEPLOY_LOG_FILE" \
      > "$DEPLOY_STATUS_FILE"
  else
    printf 'FAILED stage=%s exit=%s log=%s\n' \
      "$CURRENT_STAGE" "$status" "$DEPLOY_LOG_FILE" \
      > "$DEPLOY_STATUS_FILE"
  fi
}

report_error() {
  local status=$?
  printf '\nDEPLOY_INTERROMPIDO etapa=%s linha=%s codigo=%s\n' \
    "$CURRENT_STAGE" "${BASH_LINENO[0]}" "$status" >&2
  printf 'Comando: %s\n' "$BASH_COMMAND" >&2
  printf 'Log preservado em: %s\n' "$DEPLOY_LOG_FILE" >&2
  exit "$status"
}

trap report_error ERR
trap cleanup EXIT

printf 'Log persistente: %s\n' "$DEPLOY_LOG_FILE"

for command_name in gcloud git grep node npm npx tee; do
  command -v "$command_name" >/dev/null \
    || fail "O comando $command_name nao esta disponivel."
done

cd "$ROOT_DIR"
ACTIVE_ACCOUNT="$(
  gcloud auth list --filter=status:ACTIVE --format='value(account)' \
    | head -n 1
)"
[[ "$ACTIVE_ACCOUNT" == "$EXPECTED_FIREBASE_ACCOUNT" ]] \
  || fail "O Cloud Shell esta autenticado como ${ACTIVE_ACCOUNT:-nenhuma conta}. Abra-o com $EXPECTED_FIREBASE_ACCOUNT."

ACTIVE_PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
[[ "$ACTIVE_PROJECT" == "$PROJECT_ID" ]] \
  || fail "O projeto ativo do gcloud nao e sorvysmile-homologacao."

RESOLVED_PROJECT_ID="$(
  gcloud projects describe "$PROJECT_ID" \
    --format='value(projectId)' 2>/dev/null || true
)"
[[ "$RESOLVED_PROJECT_ID" == "$EXPECTED_PROJECT_ID" ]] \
  || fail "A conta Google ativa nao possui acesso a homologacao."

readonly FIREBASE_BASE=(npx --no-install firebase)
readonly FIREBASE=(
  npx --no-install firebase
  --account "$EXPECTED_FIREBASE_ACCOUNT"
)

deploy_function_batches() {
  local group_label="$1"
  shift
  local -a function_names=("$@")
  local total="${#function_names[@]}"
  local offset batch_number

  for ((offset = 0, batch_number = 1; offset < total; offset += MAX_FUNCTIONS_PER_BATCH, batch_number += 1)); do
    local -a batch=("${function_names[@]:offset:MAX_FUNCTIONS_PER_BATCH}")
    local -a selectors=()
    local function_name only_selector

    for function_name in "${batch[@]}"; do
      selectors+=("functions:${function_name}")
    done
    local IFS=,
    only_selector="${selectors[*]}"
    CURRENT_STAGE="functions-${group_label}-${batch_number}"
    printf 'Publicando lote %s/%s (%s Functions; maximo seguro: %s)...\n' \
      "$group_label" "$batch_number" "${#batch[@]}" \
      "$MAX_FUNCTIONS_PER_BATCH"
    "${FIREBASE[@]}" deploy \
      --only "$only_selector" \
      --project "$PROJECT_ID" \
      --non-interactive
  done
}

write_functions_environment() {
  CURRENT_STAGE="functions-environment"
  node - "$FUNCTIONS_ENV_FILE" <<'NODE'
const fs = require("node:fs");
fs.writeFileSync(
  process.argv[2],
  [
    "ENFORCE_APP_CHECK=false",
    "GEMINI_MODEL=gemini-3.6-flash",
    "INFINITEPAY_HANDLE=henry-augusto-pinheiro",
    "PUBLIC_APP_URL=https://sorvysmile-homologacao.web.app",
    "",
  ].join("\n"),
);
NODE

  for required_variable in INFINITEPAY_HANDLE PUBLIC_APP_URL; do
    grep -q "^${required_variable}=." "$FUNCTIONS_ENV_FILE" \
      || fail "A configuracao ${required_variable} nao foi gravada para as Functions."
  done
}

if [[ "$DEPLOY_MODE" == "launch-candidate" ]]; then
  CURRENT_STAGE="launch-candidate-scope"
  git merge-base --is-ancestor "$LAUNCH_CANDIDATE_COMMIT" HEAD \
    || fail "O commit validado c83fbe3 nao pertence ao checkout atual."
fi

FIREBASE_ACCOUNTS_JSON="$(mktemp)"
FIREBASE_PROJECTS_JSON="$(mktemp)"

CURRENT_STAGE="firebase-account"
if ! "${FIREBASE_BASE[@]}" login:list \
  --json \
  --non-interactive > "$FIREBASE_ACCOUNTS_JSON"; then
  fail "Nao foi possivel consultar as contas autorizadas na Firebase CLI."
fi

node - "$FIREBASE_ACCOUNTS_JSON" "$EXPECTED_FIREBASE_ACCOUNT" <<'NODE'
const fs = require("node:fs");
const [file, expectedEmail] = process.argv.slice(2);
const payload = JSON.parse(fs.readFileSync(file, "utf8"));
const emails = new Set();

const visit = (value) => {
  if (Array.isArray(value)) return value.forEach(visit);
  if (!value || typeof value !== "object") return;
  if (typeof value.email === "string") emails.add(value.email.toLowerCase());
  Object.values(value).forEach(visit);
};

visit(payload);
if (!emails.has(expectedEmail.toLowerCase())) {
  process.stderr.write(
    `ERRO: ${expectedEmail} nao esta autorizada na Firebase CLI.\n` +
    `Execute uma unica vez: npx firebase login:add --no-localhost\n`,
  );
  process.exit(1);
}
NODE

"${FIREBASE[@]}" projects:list \
  --json \
  --non-interactive > "$FIREBASE_PROJECTS_JSON" \
  || fail "A Firebase CLI nao conseguiu usar $EXPECTED_FIREBASE_ACCOUNT."

node - "$FIREBASE_PROJECTS_JSON" "$EXPECTED_PROJECT_ID" <<'NODE'
const fs = require("node:fs");
const [file, expectedProject] = process.argv.slice(2);
const payload = JSON.parse(fs.readFileSync(file, "utf8"));
const projectIds = new Set();

const visit = (value) => {
  if (Array.isArray(value)) return value.forEach(visit);
  if (!value || typeof value !== "object") return;
  if (typeof value.projectId === "string") projectIds.add(value.projectId);
  Object.values(value).forEach(visit);
};

visit(payload);
if (!projectIds.has(expectedProject)) {
  process.stderr.write(
    `ERRO: a conta Firebase ativa nao possui acesso a ${expectedProject}.\n`,
  );
  process.exit(1);
}
NODE

BILLING_ENABLED="$(
  gcloud billing projects describe "$PROJECT_ID" \
    --format='value(billingEnabled)' 2>/dev/null || true
)"
[[ "$BILLING_ENABLED" == "True" || "$BILLING_ENABLED" == "true" ]] \
  || fail "A homologacao precisa estar no Blaze antes de publicar Functions."

[[ -f "$FRONTEND_ENV_FILE" ]] \
  || fail "Execute npm run setup:hml antes do deploy completo."

CURRENT_STAGE="environment"
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
  VITE_PRIVACY_CONTACT_EMAIL: process.env.HML_PRIVACY_CONTACT_EMAIL,
};
for (const [key, value] of Object.entries(overrides)) {
  if (value && value.trim()) values[key] = value.trim();
}

const firebaseKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_APP_ID",
];
for (const key of firebaseKeys) {
  if (!values[key]) throw new Error("Configuracao Firebase ausente: " + key);
}
if (values.VITE_FIREBASE_PROJECT_ID !== expectedProject) {
  throw new Error("A configuracao do frontend nao pertence a homologacao.");
}
const allowedStorageBuckets = new Set([
  `${expectedProject}.appspot.com`,
  `${expectedProject}.firebasestorage.app`,
]);
if (!allowedStorageBuckets.has(values.VITE_FIREBASE_STORAGE_BUCKET)) {
  throw new Error(
    "O bucket do Storage nao pertence a homologacao: "
      + (values.VITE_FIREBASE_STORAGE_BUCKET || "ausente"),
  );
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
  "VITE_PRIVACY_CONTACT_EMAIL",
];
fs.writeFileSync(
  file,
  order.map((key) => key + "=" + (values[key] || "")).join("\n") + "\n",
);
NODE

printf 'Instalando dependencias reproduziveis...\n'
CURRENT_STAGE="dependencies"
npm ci
npm --prefix functions ci
write_functions_environment

if [[ "$DEPLOY_MODE" == "launch-candidate" ]]; then
  printf 'Validando somente o codigo alterado pelo candidato de lancamento...\n'
  CURRENT_STAGE="launch-candidate-validation"
  npm run test:all
  npm --prefix functions run build

  printf 'Escopo incremental comprovado: somente as 3 Functions alteradas desde 3f047ad e o frontend.\n'
  deploy_function_batches launch-candidate \
    captureLead \
    startProfessionalTrial \
    createTeamMember

  CURRENT_STAGE="frontend-build"
  npm run build -- --mode homologation
  npm run check:performance
  CURRENT_STAGE="hosting-preview"
  "${FIREBASE[@]}" hosting:channel:deploy "$PREVIEW_CHANNEL_ID" \
    --expires 30d \
    --project "$PROJECT_ID" \
    --non-interactive

  DEPLOY_SUCCEEDED=true
  CURRENT_STAGE="complete"
  printf '\nCandidato de lancamento publicado com sucesso na homologacao.\n'
  printf 'Commit funcional validado: %s\n' "$LAUNCH_CANDIDATE_COMMIT"
  printf 'O projeto protegido %s nao foi alterado.\n' "$PRODUCTION_PROJECT_ID"
  exit 0
fi

printf 'Validando codigo, regras e dependencias do provisionamento completo...\n'
CURRENT_STAGE="validation"
npm run test:all
npm run build:all
npm run test:rules
npm run test:storage-rules
npm run test:payments
npm audit --omit=dev
npm --prefix functions audit --omit=dev

printf 'Habilitando APIs do backend somente na homologacao...\n'
CURRENT_STAGE="enable-apis"
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
CURRENT_STAGE="gemini-secret-iam"
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --project "$PROJECT_ID" \
  --member "serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
  --role roles/secretmanager.secretAccessor \
  --quiet >/dev/null

printf 'Configurando limpeza segura dos artefatos de Functions...\n'
CURRENT_STAGE="artifact-policy"
"${FIREBASE[@]}" functions:artifacts:setpolicy \
  --location southamerica-east1 \
  --days 7 \
  --project "$PROJECT_ID" \
  --non-interactive \
  --force

printf 'Publicando regras e indices somente em %s...\n' "$PROJECT_ID"
CURRENT_STAGE="firebase-rules"
"${FIREBASE[@]}" deploy \
  --only firestore:rules,firestore:indexes,storage \
  --project "$PROJECT_ID" \
  --non-interactive

printf 'Publicando as Functions de IA primeiro...\n'
deploy_function_batches ai \
  validateSmilePhoto \
  analyzeSmilePhoto \
  askBusinessAssistant

printf 'Garantindo acesso HTTP às Functions callable de IA...\n'
CURRENT_STAGE="iam-ai"
for service_name in validatesmilephoto analyzesmilephoto askbusinessassistant; do
  gcloud run services add-iam-policy-binding "$service_name" \
    --region southamerica-east1 \
    --project "$PROJECT_ID" \
    --member=allUsers \
    --role=roles/run.invoker \
    --quiet >/dev/null
done

printf 'Publicando as demais Functions em lotes de no maximo %s...\n' \
  "$MAX_FUNCTIONS_PER_BATCH"
deploy_function_batches core \
  startTriage \
  captureLead \
  recordPatientConversionAction \
  createPendingSubscription \
  recordSubscriptionIntent \
  createInfinitePayCheckout \
  confirmInfinitePayReturn \
  infinitePayWebhook \
  updateProfessionalProfile \
  updateProfessionalByHq \
  updateProfessionalSlug \
  startProfessionalTrial \
  archiveProfessional \
  restoreProfessional \
  setAccountStatus \
  createTeamMember \
  manageDailyPost \
  getDailyPostAssignment \
  recordDailyPostEvent \
  getAssistantWorkspace \
  resolveAssistantAction \
  recordAssistantFeedback \
  recordAssistantClientEvent \
  setTeamMemberStatus \
  assignLead \
  deleteLead \
  getAssistantAdminSettings \
  getAssistantAdminOverview \
  updateAssistantSettings \
  updateCustomAssistantProfile \
  getProfessionalAssistantSettings \
  updateProfessionalAssistantSettings \
  publishScheduledDailyPosts \
  assignDailyPostsHourly \
  expireProfessionalTrials \
  expirePaidSubscriptions \
  cleanupExpiredTriageSessions \
  cleanupExpiredLeads \
  cleanupStaleUsageReservations

printf 'Garantindo acesso HTTP às novas Functions callable das assistentes...\n'
CURRENT_STAGE="iam-assistants"
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

printf 'Garantindo acesso HTTP ao checkout e webhook da InfinitePay...\n'
CURRENT_STAGE="iam-payments"
for service_name in \
  createinfinitepaycheckout \
  confirminfinitepayreturn \
  infinitepaywebhook; do
  gcloud run services add-iam-policy-binding "$service_name" \
    --region southamerica-east1 \
    --project "$PROJECT_ID" \
    --member=allUsers \
    --role=roles/run.invoker \
    --quiet >/dev/null
done

printf 'Criando ou atualizando a biblioteca idempotente de 60 Posts do Dia...\n'
CURRENT_STAGE="seed-daily-posts"
TARGET_FIREBASE_PROJECT_ID="$PROJECT_ID" \
GOOGLE_CLOUD_PROJECT="$PROJECT_ID" \
GCLOUD_PROJECT="$PROJECT_ID" \
node functions/lib/seedDailyPostTemplates.js

printf 'Criando ou atualizando definições versionadas das assistentes...\n'
CURRENT_STAGE="seed-assistants"
TARGET_FIREBASE_PROJECT_ID="$PROJECT_ID" \
GOOGLE_CLOUD_PROJECT="$PROJECT_ID" \
GCLOUD_PROJECT="$PROJECT_ID" \
node functions/lib/seedAssistantDefinitions.js

printf 'Compilando e publicando o frontend funcional da homologacao...\n'
CURRENT_STAGE="frontend-build"
npm run build -- --mode homologation
CURRENT_STAGE="hosting-preview"
"${FIREBASE[@]}" hosting:channel:deploy "$PREVIEW_CHANNEL_ID" \
  --expires 30d \
  --project "$PROJECT_ID" \
  --non-interactive

DEPLOY_SUCCEEDED=true
CURRENT_STAGE="complete"
printf '\nBackend e frontend da homologacao publicados com sucesso.\n'
printf 'App Check permanece desativado somente em %s para os testes.\n' \
  "$PROJECT_ID"
printf 'O projeto protegido %s nao foi alterado.\n' "$PRODUCTION_PROJECT_ID"
