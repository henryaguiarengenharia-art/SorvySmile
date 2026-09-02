import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scriptPath = "scripts/setup-firebase-homologation.sh";
const fullDeployScriptPath =
  "scripts/deploy-firebase-homologation-full.sh";
const seedScriptPath = "scripts/seed-firebase-homologation.sh";
const smokeScriptPath = "scripts/smoke-test-homologation.mjs";
const geminiRepairScriptPath = "scripts/repair-gemini-homologation.sh";

function expectFunctionInDeployPlan(
  script: string,
  functionName: string,
): void {
  expect(script).toMatch(
    new RegExp(`^\\s+${functionName}(?:\\s+\\\\)?$`, "m"),
  );
}

describe("protecoes da homologacao Firebase", () => {
  it("recusa explicitamente o projeto de producao", () => {
    const result = spawnSync("bash", [scriptPath, "--verify-only"], {
      encoding: "utf8",
      env: {
        ...process.env,
        FIREBASE_PROJECT_ID: "sorvysmile",
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("projeto de producao sorvysmile esta protegido");
  });

  it("aceita somente o ID exato da homologacao sem executar alteracoes", () => {
    const result = spawnSync("bash", [scriptPath, "--verify-only"], {
      encoding: "utf8",
      env: {
        ...process.env,
        FIREBASE_PROJECT_ID: "sorvysmile-homologacao",
      },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Nenhuma alteracao foi executada");
  });

  it("nao publica Functions, Storage, InfinitePay ou o canal live", () => {
    const script = readFileSync(scriptPath, "utf8");

    expect(script).toContain("--only firestore:rules,firestore:indexes");
    expect(script).toContain("hosting:channel:deploy");
    expect(script).not.toMatch(/--only[^\n]*(functions|storage)/);
    expect(script).not.toContain("firebase deploy --only hosting");
    expect(script).not.toContain("VITE_PAYMENT_URL_LITE: config");
  });

  it("informa o projeto de cota e preserva o diagnostico das APIs Google", () => {
    const script = readFileSync(scriptPath, "utf8");

    expect(script).toContain(
      'X-Goog-User-Project: ${FIREBASE_PROJECT_ID}',
    );
    expect(script).toContain("--output \"${response_file}\"");
    expect(script).toContain("print_google_api_error \"${response_file}\"");
    expect(script).not.toContain("--fail-with-body");
  });
});

describe("deploy funcional da homologacao", () => {
  it("recusa producao antes de consultar credenciais ou faturamento", () => {
    const result = spawnSync("bash", [fullDeployScriptPath, "--verify-only"], {
      encoding: "utf8",
      env: {
        ...process.env,
        FIREBASE_PROJECT_ID: "sorvysmile",
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("projeto de producao sorvysmile esta protegido");
  });

  it("mantem App Check obrigatorio por padrao e abre excecao apenas na HML", () => {
    const functionsSource = readFileSync("functions/src/index.ts", "utf8");
    const deployScript = readFileSync(fullDeployScriptPath, "utf8");

    expect(functionsSource).toContain(
      'defineBoolean("ENFORCE_APP_CHECK"',
    );
    expect(functionsSource).not.toContain("enforceAppCheck: true");
    expect(deployScript).toContain("ENFORCE_APP_CHECK=false");
    expect(deployScript).toContain(
      'FUNCTIONS_ENV_FILE="$ROOT_DIR/functions/.env.sorvysmile-homologacao"',
    );
    expect(deployScript).not.toContain(".env.sorvysmile\n");
  });

  it("exige Blaze, restaura a Gemini API do original e publica em lotes seguros", () => {
    const script = readFileSync(fullDeployScriptPath, "utf8");
    const functionsSource = readFileSync("functions/src/index.ts", "utf8");
    const geminiSource = readFileSync("functions/src/gemini.ts", "utf8");

    expect(script).toContain("billingEnabled");
    expect(script).toContain("generativelanguage.googleapis.com");
    expect(script).toContain("secretmanager.googleapis.com");
    expect(script).toContain("roles/secretmanager.secretAccessor");
    expect(script).toContain("GEMINI_MODEL=gemini-3.6-flash");
    expect(script).toContain("gcloud run services add-iam-policy-binding");
    expect(script).toContain("roles/run.invoker");
    expect(script).toContain("GEMINI_API_KEY");
    expect(functionsSource).toContain('defineSecret("GEMINI_API_KEY")');
    expect(functionsSource).toContain("secrets: [GEMINI_API_KEY]");
    expect(geminiSource).toContain("new GoogleGenAI({ apiKey })");
    expect(geminiSource).not.toContain("enterprise: true");
    expect(script).toContain("INFINITEPAY_HANDLE=henry-augusto-pinheiro");
    expect(script).toContain("PUBLIC_APP_URL=https://sorvysmile-homologacao.web.app");
    expectFunctionInDeployPlan(script, "createInfinitePayCheckout");
    expectFunctionInDeployPlan(script, "confirmInfinitePayReturn");
    expectFunctionInDeployPlan(script, "infinitePayWebhook");
    expectFunctionInDeployPlan(script, "expirePaidSubscriptions");
    expect(script).toContain('"VITE_FIREBASE_STORAGE_BUCKET"');
    expect(script).toContain("firebasestorage.app");
    expect(script).toContain("appspot.com");
    expect(script).toContain("O bucket do Storage nao pertence a homologacao");
    expectFunctionInDeployPlan(script, "validateSmilePhoto");
    expectFunctionInDeployPlan(script, "analyzeSmilePhoto");
    expectFunctionInDeployPlan(script, "recordPatientConversionAction");
    expect(script).toContain("functions:artifacts:setpolicy");
    expect(script).toContain("--days 7");
    expect(script).not.toContain(
      "--only firestore:rules,firestore:indexes,functions",
    );
    expect(script).toContain("hosting:channel:deploy");
  });

  it("fixa a mesma conta Google no gcloud e em todas as chamadas Firebase", () => {
    const script = readFileSync(fullDeployScriptPath, "utf8");

    expect(script).toContain(
      'EXPECTED_FIREBASE_ACCOUNT="000.henry@gmail.com"',
    );
    expect(script).toContain("gcloud auth list");
    expect(script).toContain('"${FIREBASE_BASE[@]}" login:list');
    expect(script).toContain('--account "$EXPECTED_FIREBASE_ACCOUNT"');
    expect(script).toContain('"${FIREBASE[@]}" deploy');
    expect(script).toContain('"${FIREBASE[@]}" hosting:channel:deploy');
  });

  it("limita cada lote a dez Functions e preserva o erro em log", () => {
    const script = readFileSync(fullDeployScriptPath, "utf8");

    expect(script).toContain("MAX_FUNCTIONS_PER_BATCH=10");
    expect(script).toContain("deploy_function_batches");
    expect(script).toContain("DEPLOY_INTERROMPIDO etapa=");
    expect(script).toContain(".deploy-logs");
    expect(script).not.toContain(
      "functions:startTriage,functions:captureLead,functions:recordPatientConversionAction",
    );
  });

  it("oferece deploy incremental exato para o candidato c83fbe3", () => {
    const script = readFileSync(fullDeployScriptPath, "utf8");

    expect(script).toContain(
      'LAUNCH_CANDIDATE_COMMIT="c83fbe349a5ee3f6c6361c4d34eece4c942538c7"',
    );
    expect(script).toContain('--launch-candidate');
    expect(script).toMatch(
      /deploy_function_batches launch-candidate\s+\\\n\s+captureLead\s+\\\n\s+startProfessionalTrial\s+\\\n\s+createTeamMember/,
    );
    const incrementalBlock = script.slice(
      script.indexOf('if [[ "$DEPLOY_MODE" == "launch-candidate" ]]', 5000),
      script.indexOf(
        "Validando codigo, regras e dependencias do provisionamento completo",
      ),
    );
    expect(incrementalBlock).toContain("npm run test:all");
    expect(incrementalBlock).toContain("npm --prefix functions run build");
    expect(incrementalBlock).toContain("npm run check:performance");
    expect(incrementalBlock).not.toContain("npm run test:rules");
    expect(incrementalBlock).not.toContain("npm run test:storage-rules");
    expect(incrementalBlock).not.toContain("npm run test:payments");
  });

  it("protege e valida o reparo isolado da IA antes do deploy", () => {
    const result = spawnSync("bash", [geminiRepairScriptPath, "--verify-only"], {
      encoding: "utf8",
      env: {
        ...process.env,
        FIREBASE_PROJECT_ID: "sorvysmile",
      },
    });
    const script = readFileSync(geminiRepairScriptPath, "utf8");

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("projeto de producao sorvysmile esta protegido");
    expect(script).toContain("verify-gemini-api.mjs");
    expect(script).toContain(
      "functions:validateSmilePhoto,functions:analyzeSmilePhoto",
    );
    expect(script).not.toContain("hosting:channel:deploy");
  });

  it("protege tambem o provisionamento de acessos", () => {
    const result = spawnSync("bash", [seedScriptPath, "--verify-only"], {
      encoding: "utf8",
      env: {
        ...process.env,
        FIREBASE_PROJECT_ID: "sorvysmile",
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("projeto de producao sorvysmile esta protegido");
  });

  it("mantem o smoke test restrito a homologacao e sem imagem no repositorio", () => {
    const script = readFileSync(smokeScriptPath, "utf8");

    expect(script).toContain('EXPECTED_PROJECT_ID = "sorvysmile-homologacao"');
    expect(script).toContain('signInAnonymously(auth)');
    expect(script).toContain('deleteUser(anonymousUser)');
    expect(script).toContain('process.env.HML_SMOKE_IMAGE_PATH');
    expect(script).not.toContain('tests/fixtures');
    expect(script).not.toContain("sorvysmile.web.app");
  });
});
