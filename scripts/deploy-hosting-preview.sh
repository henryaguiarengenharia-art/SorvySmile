#!/usr/bin/env bash

set -euo pipefail

readonly FIREBASE_PROJECT_ID="sorvysmile"
readonly PREVIEW_CHANNEL_ID="migracao-smile"

export VITE_FIREBASE_API_KEY="AIzaSyBSb8DndxCaxZWi6dAayLs7xtTSfPQLiKA"
export VITE_FIREBASE_AUTH_DOMAIN="sorvysmile.firebaseapp.com"
export VITE_FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID}"
export VITE_FIREBASE_STORAGE_BUCKET="sorvysmile.firebasestorage.app"
export VITE_FIREBASE_MESSAGING_SENDER_ID="1047671293768"
export VITE_FIREBASE_APP_ID="1:1047671293768:web:2e2df8c47b99544a0bd57d"
export VITE_FIREBASE_APPCHECK_SITE_KEY=""
export VITE_DEFAULT_PROFESSIONAL_SLUG=""
export VITE_USE_FIREBASE_EMULATORS="false"
export VITE_PAYMENT_URL_LITE="https://invoice.infinitepay.io/plans/henry-augusto-pinheiro/7f6uzHxoqT"
export VITE_PAYMENT_URL_PRO="https://invoice.infinitepay.io/plans/henry-augusto-pinheiro/dakCr5umz"
export VITE_PAYMENT_URL_ELITE="https://invoice.infinitepay.io/plans/henry-augusto-pinheiro/7f70xygLaj"
export VITE_SALES_WHATSAPP="5531994284436"
export VITE_PRIVACY_CONTACT_EMAIL="henry.aguiar.engenharia@gmail.com"

if [[ ! -f package.json || ! -f firebase.json ]]; then
  printf 'Execute este script na raiz do repositório SorvySmile.\n' >&2
  exit 1
fi

printf 'Instalando dependências fixadas no lockfile...\n'
npm ci

printf 'Executando os testes do frontend...\n'
npm test

printf 'Compilando o frontend de homologação...\n'
npm run build

printf 'Publicando somente o canal temporário %s...\n' "${PREVIEW_CHANNEL_ID}"
npx --no-install firebase hosting:channel:deploy "${PREVIEW_CHANNEL_ID}" \
  --expires 14d \
  --project "${FIREBASE_PROJECT_ID}"
