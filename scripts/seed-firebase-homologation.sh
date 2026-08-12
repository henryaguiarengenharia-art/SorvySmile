#!/usr/bin/env bash
set -Eeuo pipefail

readonly EXPECTED_PROJECT_ID="sorvysmile-homologacao"
readonly PRODUCTION_PROJECT_ID="sorvysmile"
readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail() {
  printf 'Erro: %s\n' "$1" >&2
  exit 1
}

PROJECT_ID="${FIREBASE_PROJECT_ID:-${EXPECTED_PROJECT_ID}}"
[[ "${PROJECT_ID}" != "${PRODUCTION_PROJECT_ID}" ]] \
  || fail "O projeto de producao sorvysmile esta protegido."
[[ "${PROJECT_ID}" == "${EXPECTED_PROJECT_ID}" ]] \
  || fail "Este seed aceita somente sorvysmile-homologacao."

if [[ "${1:-}" == "--verify-only" ]]; then
  printf 'Protecao validada para %s. Nenhum usuario foi criado.\n' \
    "${PROJECT_ID}"
  exit 0
fi
[[ $# -eq 0 ]] || fail "Use sem argumentos ou somente com --verify-only."

for variable in \
  HML_HQ_EMAIL HML_HQ_PASSWORD \
  HML_CLINIC_EMAIL HML_CLINIC_PASSWORD HML_CLINIC_WHATSAPP; do
  [[ -n "${!variable:-}" ]] || fail "Defina ${variable} antes de executar."
done

[[ ${#HML_HQ_PASSWORD} -ge 10 ]] \
  || fail "HML_HQ_PASSWORD precisa ter pelo menos 10 caracteres."
[[ ${#HML_CLINIC_PASSWORD} -ge 10 ]] \
  || fail "HML_CLINIC_PASSWORD precisa ter pelo menos 10 caracteres."

ACTIVE_PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
[[ "${ACTIVE_PROJECT}" == "${PROJECT_ID}" ]] \
  || fail "O projeto ativo do gcloud nao e sorvysmile-homologacao."

cd "${ROOT_DIR}"
export TARGET_FIREBASE_PROJECT_ID="${PROJECT_ID}"
export GCLOUD_PROJECT="${PROJECT_ID}"
export GOOGLE_CLOUD_PROJECT="${PROJECT_ID}"

npm --prefix functions run build

HQ_EMAIL="${HML_HQ_EMAIL}" \
HQ_PASSWORD="${HML_HQ_PASSWORD}" \
HQ_NAME="${HML_HQ_NAME:-Administracao Sorvy HML}" \
node functions/lib/seedHq.js

PILOT_EMAIL="${HML_CLINIC_EMAIL}" \
PILOT_PASSWORD="${HML_CLINIC_PASSWORD}" \
PILOT_WHATSAPP="${HML_CLINIC_WHATSAPP}" \
PILOT_NAME="${HML_CLINIC_NAME:-Clinica Demonstracao SorvySmile}" \
PILOT_SLUG="${HML_CLINIC_SLUG:-clinica-demo-hml}" \
PILOT_PLAN="network" \
node functions/lib/seedPilot.js

printf 'Acessos HQ e clinica configurados somente em %s.\n' "${PROJECT_ID}"
