import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scriptPath = "scripts/setup-firebase-homologation.sh";
const fullDeployScriptPath =
  "scripts/deploy-firebase-homologation-full.sh";
const seedScriptPath = "scripts/seed-firebase-homologation.sh";
const smokeScriptPath = "scripts/smoke-test-homologation.mjs";

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

  it("exige Blaze, usa Vertex sem chave e publica em lotes seguros", () => {
    const script = readFileSync(fullDeployScriptPath, "utf8");
    const functionsSource = readFileSync("functions/src/index.ts", "utf8");
    const geminiSource = readFileSync("functions/src/gemini.ts", "utf8");

    expect(script).toContain("billingEnabled");
    expect(script).toContain("aiplatform.googleapis.com");
    expect(script).toContain("roles/aiplatform.user");
    expect(script).toContain("GEMINI_VERTEX_LOCATION=southamerica-east1");
    expect(script).not.toContain("GEMINI_API_KEY");
    expect(functionsSource).not.toContain("defineSecret");
    expect(geminiSource).toContain("vertexai: true");
    expect(geminiSource).not.toContain("apiKey");
    expect(script).toContain("VITE_PAYMENT_URL_NETWORK");
    expect(script).toContain(
      "functions:validateSmilePhoto,functions:analyzeSmilePhoto",
    );
    expect(script).toContain("functions:artifacts:setpolicy");
    expect(script).toContain("--days 7");
    expect(script).not.toContain(
      "--only firestore:rules,firestore:indexes,functions",
    );
    expect(script).toContain("hosting:channel:deploy");
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
