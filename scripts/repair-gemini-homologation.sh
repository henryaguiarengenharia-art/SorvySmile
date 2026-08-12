#!/usr/bin/env bash
set -Eeuo pipefail

readonly PROJECT_ID="sorvysmile-homologacao"
readonly PRODUCTION_PROJECT_ID="sorvysmile"
readonly ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
readonly FUNCTIONS_ENV_FILE="$ROOT_DIR/functions/.env.sorvysmile-homologacao"
readonly MODEL="gemini-3.6-flash"

fail() {
  printf 'Erro: %s\n' "$1" >&2
  exit 1
}

if [[ "${FIREBASE_PROJECT_ID:-$PROJECT_ID}" == "$PRODUCTION_PROJECT_ID" ]]; then
  fail "O projeto de producao sorvysmile esta protegido."
fi
[[ "${FIREBASE_PROJECT_ID:-$PROJECT_ID}" == "$PROJECT_ID" ]] \
  || fail "Este reparo aceita somente sorvysmile-homologacao."

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
  || fail "Execute: gcloud config set project sorvysmile-homologacao"

gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1 \
  || fail "A conta Google ativa nao possui acesso a homologacao."

printf 'Habilitando somente as APIs usadas pelo reparo...\n'
gcloud services enable \
  generativelanguage.googleapis.com \
  secretmanager.googleapis.com \
  --project "$PROJECT_ID" \
  --quiet

if ! gcloud secrets describe GEMINI_API_KEY \
  --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud secrets create GEMINI_API_KEY \
    --project "$PROJECT_ID" \
    --replication-policy=automatic \
    --quiet
fi

SECRET_VERSION="$(
  gcloud secrets versions list GEMINI_API_KEY \
    --project "$PROJECT_ID" \
    --filter='state=ENABLED' \
    --limit=1 \
    --format='value(name)' 2>/dev/null || true
)"

SECRET_OK=false
if [[ -n "$SECRET_VERSION" ]]; then
  printf 'Validando o secret existente sem exibir a chave...\n'
  if gcloud secrets versions access latest \
    --secret GEMINI_API_KEY \
    --project "$PROJECT_ID" 2>/dev/null \
    | GEMINI_MODEL="$MODEL" node scripts/verify-gemini-api.mjs; then
    SECRET_OK=true
  fi
fi

if [[ "$SECRET_OK" != "true" ]]; then
  printf 'O secret esta ausente ou nao passou no teste multimodal.\n'
  printf 'Crie/obtenha uma chave da Gemini API para a homologacao.\n'
  read -r -s -p 'Cole a chave Gemini e pressione Enter: ' GEMINI_KEY
  printf '\n'
  [[ ${#GEMINI_KEY} -ge 20 ]] || fail "A chave informada parece invalida."

  if ! printf '%s' "$GEMINI_KEY" \
    | GEMINI_MODEL="$MODEL" node scripts/verify-gemini-api.mjs; then
    unset GEMINI_KEY
    fail "A chave nao acessa o modelo multimodal. Nenhuma versao foi gravada."
  fi

  printf '%s' "$GEMINI_KEY" \
    | gcloud secrets versions add GEMINI_API_KEY \
      --project "$PROJECT_ID" \
      --data-file=- \
      --quiet >/dev/null
  unset GEMINI_KEY
fi

PROJECT_NUMBER="$(
  gcloud projects describe "$PROJECT_ID" \
    --format='value(projectNumber)' 2>/dev/null || true
)"
[[ "$PROJECT_NUMBER" =~ ^[0-9]+$ ]] \
  || fail "Nao foi possivel identificar o numero do projeto."
RUNTIME_SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

printf 'Concedendo à Function acesso somente ao secret Gemini...\n'
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --project "$PROJECT_ID" \
  --member "serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
  --role roles/secretmanager.secretAccessor \
  --quiet >/dev/null

node - "$FUNCTIONS_ENV_FILE" <<'NODE'
const fs = require("node:fs");
fs.writeFileSync(
  process.argv[2],
  "ENFORCE_APP_CHECK=false\nGEMINI_MODEL=gemini-3.6-flash\n",
);
NODE

[[ -x functions/node_modules/.bin/tsc ]] || npm --prefix functions ci
[[ -x node_modules/.bin/firebase ]] || npm ci

printf 'Executando testes e compilacao das Functions...\n'
npm --prefix functions test
npm --prefix functions run build

printf 'Publicando somente as duas Functions de IA...\n'
npx --no-install firebase deploy \
  --only functions:validateSmilePhoto,functions:analyzeSmilePhoto \
  --project "$PROJECT_ID" \
  --non-interactive

printf 'Garantindo a invocacao HTTPS das Functions callable...\n'
for service_name in validatesmilephoto analyzesmilephoto; do
  gcloud run services add-iam-policy-binding "$service_name" \
    --region southamerica-east1 \
    --project "$PROJECT_ID" \
    --member=allUsers \
    --role=roles/run.invoker \
    --quiet >/dev/null
done

printf '\nReparo concluido: Gemini API validada e Functions publicadas.\n'
printf 'Agora repita a triagem no mesmo link da homologacao.\n'
