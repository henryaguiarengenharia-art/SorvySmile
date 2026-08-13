import { describe, expect, it } from "vitest";
import { requireSeedProject } from "./seedProject.js";

describe("proteção dos seeds administrativos", () => {
  it("exige um projeto de destino explícito", () => {
    expect(() => requireSeedProject({})).toThrow(
      "TARGET_FIREBASE_PROJECT_ID",
    );
  });

  it("recusa produção sem confirmação extraordinária", () => {
    expect(() =>
      requireSeedProject({
        TARGET_FIREBASE_PROJECT_ID: "sorvysmile",
        GCLOUD_PROJECT: "sorvysmile",
      }),
    ).toThrow("produção sorvysmile está protegido");
  });

  it("recusa divergência entre o projeto ativo e o destino", () => {
    expect(() =>
      requireSeedProject({
        TARGET_FIREBASE_PROJECT_ID: "sorvysmile-homologacao",
        GCLOUD_PROJECT: "sorvysmile",
      }),
    ).toThrow("não corresponde ao destino");
  });

  it("aceita a homologação exata", () => {
    expect(
      requireSeedProject({
        TARGET_FIREBASE_PROJECT_ID: "sorvysmile-homologacao",
        GCLOUD_PROJECT: "sorvysmile-homologacao",
      }),
    ).toBe("sorvysmile-homologacao");
  });
});
