import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scriptPath = "scripts/setup-firebase-homologation.sh";

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
