#!/usr/bin/env bash

set -euo pipefail

readonly FIREBASE_PROJECT_ID="sorvysmile"
readonly PREVIEW_CHANNEL_ID="migracao-smile"

export FIREBASE_CLI_DISABLE_UPDATE_CHECK="true"
export VITE_FIREBASE_API_KEY="AIzaSyBSb8DndxCaxZWi6dAayLs7xtTSfPQLiKA"
export VITE_FIREBASE_AUTH_DOMAIN="sorvysmile.firebaseapp.com"
export VITE_FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID}"
export VITE_FIREBASE_STORAGE_BUCKET="sorvysmile.firebasestorage.app"
export VITE_FIREBASE_MESSAGING_SENDER_ID="1047671293768"
export VITE_FIREBASE_APP_ID="1:1047671293768:web:2e2df8c47b99544a0bd57d"
export VITE_FIREBASE_APPCHECK_SITE_KEY=""
export VITE_DEFAULT_PROFESSIONAL_SLUG="clinica-saude-integrada-bh"
export VITE_USE_FIREBASE_EMULATORS="false"

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
  --project "${FIREBASE_PROJECT_ID}" \
  --non-interactive
