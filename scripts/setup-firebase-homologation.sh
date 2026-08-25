#!/usr/bin/env bash

set -euo pipefail

readonly EXPECTED_PROJECT_ID="sorvysmile-homologacao"
readonly PRODUCTION_PROJECT_ID="sorvysmile"
readonly FIRESTORE_LOCATION="southamerica-east1"
readonly WEB_APP_NAME="SorvySmile Homologacao"
readonly PREVIEW_CHANNEL_ID="migracao-smile"
readonly DEMO_SLUG="clinica-demo-hml"
readonly DEMO_ACCOUNT_ID="hml_demo_clinic"
readonly DEMO_PROFESSIONAL_ID="hml_demo_professional"

FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID:-${EXPECTED_PROJECT_ID}}"
VERIFY_ONLY="false"

fail() {
  printf 'ERRO: %s\n' "$1" >&2
  exit 1
}

print_google_api_error() {
  node -e '
    const fs = require("node:fs");
    const responseFile = process.argv[1];
    try {
      const payload = JSON.parse(fs.readFileSync(responseFile, "utf8"));
      const error = payload.error ?? payload;
      const details = Array.isArray(error.details)
        ? error.details
            .map((detail) => detail?.reason ?? detail?.metadata?.reason)
            .filter(Boolean)
        : [];
      const lines = [
        error.status ? `Status Google: ${error.status}` : "",
        error.message ? `Mensagem: ${error.message}` : "",
        details.length ? `Motivo: ${details.join(", ")}` : ""
      ].filter(Boolean);
      process.stderr.write(`${lines.join("\n") || "Resposta de erro sem detalhes."}\n`);
    } catch {
      process.stderr.write("A API retornou uma resposta de erro que nao era JSON.\n");
    }
  ' "$1"
}

google_api_request() {
  local method="$1"
  local url="$2"
  local request_file="$3"
  local response_file="$4"
  local operation_name="$5"
  local access_token
  local http_status

  access_token="$(gcloud auth print-access-token)" \
    || fail "Nao foi possivel obter o token da conta Google ativa."

  if ! http_status="$(
    curl --silent --show-error \
      --request "${method}" \
      --header "Authorization: Bearer ${access_token}" \
      --header "X-Goog-User-Project: ${FIREBASE_PROJECT_ID}" \
      --header "Content-Type: application/json" \
      --data-binary "@${request_file}" \
      --output "${response_file}" \
      --write-out '%{http_code}' \
      "${url}"
  )"; then
    unset access_token
    fail "Falha de rede ao ${operation_name}."
  fi
  unset access_token

  if [[ ! "${http_status}" =~ ^2[0-9][0-9]$ ]]; then
    printf 'A API Google retornou HTTP %s ao %s.\n' \
      "${http_status}" "${operation_name}" >&2
    print_google_api_error "${response_file}"
    fail "Nao foi possivel ${operation_name}."
  fi
}

if [[ $# -gt 1 ]]; then
  fail "Use sem argumentos ou somente com --verify-only."
fi
if [[ $# -eq 1 ]]; then
  [[ "$1" == "--verify-only" ]] || fail "Argumento desconhecido: $1"
  VERIFY_ONLY="true"
fi

if [[ "${FIREBASE_PROJECT_ID}" == "${PRODUCTION_PROJECT_ID}" ]]; then
  fail "O projeto de producao sorvysmile esta protegido e foi recusado."
fi
if [[ "${FIREBASE_PROJECT_ID}" != "${EXPECTED_PROJECT_ID}" ]]; then
  fail "Projeto recusado. Esta automacao aceita somente sorvysmile-homologacao."
fi

if [[ ! -f package.json || ! -f firebase.json || ! -f firestore.rules ]]; then
  fail "Execute este script na raiz do repositorio SorvySmile."
fi

if [[ "${VERIFY_ONLY}" == "true" ]]; then
  printf 'Protecao confirmada para %s. Nenhuma alteracao foi executada.\n' \
    "${FIREBASE_PROJECT_ID}"
  exit 0
fi

for required_command in npm node gcloud curl java; do
  command -v "${required_command}" >/dev/null 2>&1 \
    || fail "Comando obrigatorio ausente: ${required_command}"
done

readonly TEMP_DIR="$(mktemp -d)"
cleanup() {
  if [[ -n "${TEMP_DIR:-}" && -d "${TEMP_DIR}" && "${TEMP_DIR}" == /tmp/* ]]; then
    rm -rf -- "${TEMP_DIR}"
  fi
}
trap cleanup EXIT

export FIREBASE_CLI_DISABLE_UPDATE_CHECK="true"

ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -n 1)"
[[ -n "${ACTIVE_ACCOUNT}" ]] \
  || fail "Nenhuma conta Google esta ativa neste Cloud Shell."

RESOLVED_PROJECT_ID="$(
  gcloud projects describe "${FIREBASE_PROJECT_ID}" \
    --format='value(projectId)' 2>/dev/null || true
)"
[[ "${RESOLVED_PROJECT_ID}" == "${EXPECTED_PROJECT_ID}" ]] \
  || fail "A conta Google ativa nao possui acesso ao projeto sorvysmile-homologacao."

printf 'Validando codigo e regras antes de configurar o Firebase...\n'
npm ci
npm --prefix functions ci
npm run test:all
npm run build:all
npm run test:rules
npm audit --omit=dev
npm --prefix functions audit --omit=dev

readonly FIREBASE=(npx --no-install firebase)

printf 'Habilitando apenas as APIs gratuitas usadas nesta primeira etapa...\n'
gcloud services enable \
  firebase.googleapis.com \
  firebasehosting.googleapis.com \
  firebaserules.googleapis.com \
  firestore.googleapis.com \
  identitytoolkit.googleapis.com \
  --project "${FIREBASE_PROJECT_ID}" \
  --quiet

printf 'Configurando Authentication por email/senha e acesso anonimo...\n'
node -e '
  const fs = require("node:fs");
  fs.writeFileSync(process.argv[1], JSON.stringify({
    signIn: {
      email: { enabled: true, passwordRequired: true },
      anonymous: { enabled: true }
    }
  }));
' "${TEMP_DIR}/auth-config.json"

google_api_request \
  PATCH \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/${FIREBASE_PROJECT_ID}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired,signIn.anonymous.enabled" \
  "${TEMP_DIR}/auth-config.json" \
  "${TEMP_DIR}/auth-response.json" \
  "configurar o Firebase Authentication"

printf 'Verificando o banco Firestore em Sao Paulo...\n'
if ! gcloud firestore databases describe \
  --database='(default)' \
  --project "${FIREBASE_PROJECT_ID}" \
  --format='value(locationId)' \
  > "${TEMP_DIR}/firestore-database.txt" 2> "${TEMP_DIR}/firestore-error.txt"; then
  FIRESTORE_ERROR="$(<"${TEMP_DIR}/firestore-error.txt")"
  if [[ "${FIRESTORE_ERROR}" != *"NOT_FOUND"* \
    && "${FIRESTORE_ERROR}" != *"does not exist"* ]]; then
    printf '%s\n' "${FIRESTORE_ERROR}" >&2
    fail "Nao foi possivel consultar o Firestore."
  fi
  "${FIREBASE[@]}" firestore:databases:create '(default)' \
    --location "${FIRESTORE_LOCATION}" \
    --edition standard \
    --delete-protection ENABLED \
    --project "${FIREBASE_PROJECT_ID}" \
    --non-interactive
else
  EXISTING_FIRESTORE_LOCATION="$(<"${TEMP_DIR}/firestore-database.txt")"
  [[ "${EXISTING_FIRESTORE_LOCATION}" == "${FIRESTORE_LOCATION}" ]] \
    || fail "O Firestore existente nao esta em southamerica-east1; nenhuma publicacao foi feita."
fi

printf 'Registrando ou reutilizando o aplicativo Web da homologacao...\n'
"${FIREBASE[@]}" apps:list WEB \
  --project "${FIREBASE_PROJECT_ID}" \
  --json > "${TEMP_DIR}/apps.json"

find_web_app_id() {
  node -e '
    const fs = require("node:fs");
    const source = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const expectedName = process.argv[2];
    const candidates = [];
    const visit = (value) => {
      if (Array.isArray(value)) return value.forEach(visit);
      if (!value || typeof value !== "object") return;
      if (typeof value.appId === "string") candidates.push(value);
      Object.values(value).forEach(visit);
    };
    visit(source);
    const app = candidates.find((candidate) => candidate.displayName === expectedName);
    process.stdout.write(app?.appId ?? "");
  ' "$1" "${WEB_APP_NAME}"
}

WEB_APP_ID="$(find_web_app_id "${TEMP_DIR}/apps.json")"
if [[ -z "${WEB_APP_ID}" ]]; then
  "${FIREBASE[@]}" apps:create WEB "${WEB_APP_NAME}" \
    --project "${FIREBASE_PROJECT_ID}" \
    --json > "${TEMP_DIR}/app-created.json"
  "${FIREBASE[@]}" apps:list WEB \
    --project "${FIREBASE_PROJECT_ID}" \
    --json > "${TEMP_DIR}/apps.json"
  WEB_APP_ID="$(find_web_app_id "${TEMP_DIR}/apps.json")"
fi
[[ -n "${WEB_APP_ID}" ]] \
  || fail "O aplicativo Web nao foi localizado depois da criacao."

"${FIREBASE[@]}" apps:sdkconfig WEB "${WEB_APP_ID}" \
  --project "${FIREBASE_PROJECT_ID}" \
  --json > "${TEMP_DIR}/sdk-config.json"

node -e '
  const fs = require("node:fs");
  const source = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const expectedProject = process.argv[2];
  const defaultSlug = process.argv[3];
  const candidates = [];
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    if (typeof value.apiKey === "string" && typeof value.appId === "string") {
      candidates.push(value);
    }
    Object.values(value).forEach(visit);
  };
  visit(source);
  const config = candidates.find((candidate) => candidate.projectId === expectedProject)
    ?? candidates[0];
  if (!config || config.projectId !== expectedProject) {
    throw new Error("A configuracao retornada nao pertence a homologacao.");
  }
  const env = {
    VITE_FIREBASE_API_KEY: config.apiKey,
    VITE_FIREBASE_AUTH_DOMAIN: config.authDomain ?? `${expectedProject}.firebaseapp.com`,
    VITE_FIREBASE_PROJECT_ID: config.projectId,
    VITE_FIREBASE_STORAGE_BUCKET: config.storageBucket ?? "",
    VITE_FIREBASE_MESSAGING_SENDER_ID: config.messagingSenderId ?? "",
    VITE_FIREBASE_APP_ID: config.appId,
    VITE_FIREBASE_APPCHECK_SITE_KEY: "",
    VITE_DEFAULT_PROFESSIONAL_SLUG: defaultSlug,
    VITE_USE_FIREBASE_EMULATORS: "false",
    VITE_PAYMENT_URL_LITE: "",
    VITE_PAYMENT_URL_PRO: "",
    VITE_PAYMENT_URL_NETWORK: "",
    VITE_PAYMENT_URL_ELITE: "",
    VITE_PRIVACY_CONTACT_EMAIL: ""
  };
  process.stdout.write(
    Object.entries(env).map(([key, value]) => `${key}=${value}`).join("\n") + "\n"
  );
' "${TEMP_DIR}/sdk-config.json" "${FIREBASE_PROJECT_ID}" "${DEMO_SLUG}" \
  > .env.homologation

printf 'Publicando regras e indices somente na homologacao...\n'
"${FIREBASE[@]}" deploy \
  --only firestore:rules,firestore:indexes \
  --project "${FIREBASE_PROJECT_ID}" \
  --non-interactive

printf 'Criando perfil demonstrativo sem dados pessoais...\n'
node -e '
  const fs = require("node:fs");
  const [projectId, accountId, professionalId, slug] = process.argv.slice(1);
  const now = String(Date.now());
  const documentName = (collection, id) =>
    `projects/${projectId}/databases/(default)/documents/${collection}/${id}`;
  const stringValue = (value) => ({ stringValue: value });
  const integerValue = (value) => ({ integerValue: String(value) });
  const booleanValue = (value) => ({ booleanValue: value });
  const writes = [
    {
      update: {
        name: documentName("accounts", accountId),
        fields: {
          id: stringValue(accountId),
          accountName: stringValue("Clinica Demonstracao SorvySmile"),
          ownerUid: stringValue("homologacao-sem-login"),
          professionalId: stringValue(professionalId),
          slug: stringValue(slug),
          plan: stringValue("network"),
          tier: stringValue("network"),
          status: stringValue("active"),
          isActive: booleanValue(true),
          ownerType: stringValue("clinic"),
          monthlyLeadLimit: integerValue(150),
          seatsTotal: integerValue(2),
          seatsUsed: integerValue(1),
          createdAtMs: integerValue(now),
          updatedAtMs: integerValue(now)
        }
      }
    },
    {
      update: {
        name: documentName("professionals", professionalId),
        fields: {
          id: stringValue(professionalId),
          accountId: stringValue(accountId),
          ownerUid: stringValue("homologacao-sem-login"),
          name: stringValue("Equipe Demonstracao SorvySmile"),
          email: stringValue("demonstracao@sorvysmile.invalid"),
          whatsapp: stringValue("5500000000000"),
          plan: stringValue("network"),
          role: stringValue("dentist"),
          publicSlug: stringValue(slug),
          isActive: booleanValue(true),
          createdAtMs: integerValue(now),
          updatedAtMs: integerValue(now)
        }
      }
    },
    {
      update: {
        name: documentName("publicProfiles", slug),
        fields: {
          slug: stringValue(slug),
          accountId: stringValue(accountId),
          professionalId: stringValue(professionalId),
          name: stringValue("Clinica Demonstracao SorvySmile"),
          whatsapp: stringValue("5500000000000"),
          specialty: stringValue("Odontologia"),
          city: stringValue("Ambiente de homologacao"),
          state: stringValue("BR"),
          bio: stringValue("Perfil ficticio para validar a migracao com seguranca."),
          plan: stringValue("network"),
          ownerType: stringValue("clinic"),
          active: booleanValue(true),
          createdAtMs: integerValue(now),
          updatedAtMs: integerValue(now)
        }
      }
    }
  ];
  fs.writeFileSync(process.argv[5], JSON.stringify({ writes }));
' "${FIREBASE_PROJECT_ID}" "${DEMO_ACCOUNT_ID}" "${DEMO_PROFESSIONAL_ID}" \
  "${DEMO_SLUG}" "${TEMP_DIR}/firestore-seed.json"

google_api_request \
  POST \
  "https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:commit" \
  "${TEMP_DIR}/firestore-seed.json" \
  "${TEMP_DIR}/firestore-seed-response.json" \
  "criar o perfil demonstrativo no Firestore"

printf 'Compilando a interface com a configuracao publica da homologacao...\n'
npm run build -- --mode homologation

printf 'Publicando o canal temporario %s somente em %s...\n' \
  "${PREVIEW_CHANNEL_ID}" "${FIREBASE_PROJECT_ID}"
"${FIREBASE[@]}" hosting:channel:deploy "${PREVIEW_CHANNEL_ID}" \
  --expires 30d \
  --project "${FIREBASE_PROJECT_ID}" \
  --non-interactive

printf '\nHomologacao gratuita configurada com sucesso.\n'
printf 'Projeto protegido de producao: %s (nao alterado).\n' "${PRODUCTION_PROJECT_ID}"
printf 'Perfil de teste: /p/%s\n' "${DEMO_SLUG}"
printf 'Functions, Gemini, App Check e InfinitePay nao foram publicados nesta etapa.\n'
