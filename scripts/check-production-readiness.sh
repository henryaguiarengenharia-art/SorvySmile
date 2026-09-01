#!/usr/bin/env bash
set -Eeuo pipefail

readonly EXPECTED_PROJECT_ID="sorvysmile"
readonly ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

fail() {
  printf 'Erro: %s\n' "$1" >&2
  exit 1
}

PROJECT_ID="${FIREBASE_PROJECT_ID:-$EXPECTED_PROJECT_ID}"
[[ "$PROJECT_ID" == "$EXPECTED_PROJECT_ID" ]] \
  || fail "O checklist de produção aceita somente sorvysmile."

for command_name in gcloud node npm npx git; do
  command -v "$command_name" >/dev/null \
    || fail "O comando $command_name não está disponível."
done

cd "$ROOT_DIR"

ACTIVE_PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
[[ "$ACTIVE_PROJECT" == "$EXPECTED_PROJECT_ID" ]] \
  || fail "Selecione sorvysmile no gcloud antes da verificação."

BILLING_ENABLED="$(
  gcloud billing projects describe "$PROJECT_ID" \
    --format='value(billingEnabled)' 2>/dev/null || true
)"
[[ "$BILLING_ENABLED" == "True" || "$BILLING_ENABLED" == "true" ]] \
  || fail "O faturamento do projeto de produção não está ativo."

for service_name in \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  cloudfunctions.googleapis.com \
  cloudscheduler.googleapis.com \
  eventarc.googleapis.com \
  generativelanguage.googleapis.com \
  pubsub.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com; do
  gcloud services list \
    --project "$PROJECT_ID" \
    --enabled \
    --filter="config.name=$service_name" \
    --format='value(config.name)' | grep -qx "$service_name" \
    || fail "API obrigatória não habilitada: $service_name"
done

gcloud secrets describe GEMINI_API_KEY \
  --project "$PROJECT_ID" >/dev/null 2>&1 \
  || fail "O secret GEMINI_API_KEY não existe em produção."

SECRET_VERSION="$(
  gcloud secrets versions list GEMINI_API_KEY \
    --project "$PROJECT_ID" \
    --filter='state=ENABLED' \
    --limit=1 \
    --format='value(name)' 2>/dev/null || true
)"
[[ -n "$SECRET_VERSION" ]] \
  || fail "GEMINI_API_KEY não possui versão ativa."

node scripts/check-production-readiness.mjs \
  --project "$PROJECT_ID" \
  --frontend-env "${PROD_FRONTEND_ENV_FILE:-.env.production}" \
  --functions-env "${PROD_FUNCTIONS_ENV_FILE:-functions/.env.sorvysmile}"

git diff --check
npm run test:all
npm run build:all
npm run test:rules
npm run test:storage-rules
npm run test:payments
npm audit --omit=dev
npm --prefix functions audit --omit=dev

printf '\nChecklist técnico aprovado. Nenhum deploy foi executado.\n'
