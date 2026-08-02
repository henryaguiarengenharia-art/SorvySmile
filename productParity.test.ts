import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const journeySource = readFileSync(
  new URL("./components/PatientJourney.tsx", import.meta.url),
  "utf8",
);

describe("paridade do produto Sorvy Smile", () => {
  it("mantém a página inicial orientada à triagem do paciente", () => {
    expect(appSource).toContain("Iniciar Minha Triagem");
    expect(appSource).toContain("Foto guiada");
    expect(appSource).toContain("Preview parcial");
    expect(appSource).toContain("Relatório completo");
  });

  it("mantém câmera e consentimento na confirmação da foto", () => {
    expect(journeySource).toContain('capture="user"');
    expect(journeySource).toContain("Deseja utilizar esta foto?");
    expect(journeySource).toContain("Utilizar esta foto");
    expect(journeySource).toContain("processamento temporário desta foto");
  });

  it("mantém preview antes da captura do contato", () => {
    expect(journeySource.indexOf('setStage("preview")')).toBeLessThan(
      journeySource.indexOf('setStage("contact")'),
    );
    expect(journeySource).toContain("Preview sem dados pessoais");
    expect(journeySource).toContain("WhatsApp com DDD");
  });

  it("mantém as duas CTAs finais aprovadas", () => {
    expect(journeySource).toContain("Agendar consulta agora");
    expect(journeySource).toContain("Prefiro que ${profile.name} entre em contato");
  });

  it("mantém linguagem informativa e não diagnóstica", () => {
    expect(appSource).toContain(
      "Triagem informativa. Não substitui consulta com cirurgião-dentista.",
    );
    expect(journeySource).toContain("Não diagnostica");
    expect(journeySource).toContain("não define urgência");
  });
});
