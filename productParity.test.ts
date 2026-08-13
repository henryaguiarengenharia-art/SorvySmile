import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const journeySource = readFileSync(
  new URL("./components/PatientJourney.tsx", import.meta.url),
  "utf8",
);
const cameraSource = readFileSync(
  new URL("./components/GuidedCamera.tsx", import.meta.url),
  "utf8",
);
const functionsSource = readFileSync("functions/src/index.ts", "utf8");

describe("paridade do produto Sorvy Smile", () => {
  it("mantém a página inicial orientada à triagem do paciente", () => {
    expect(appSource).toContain("Quero conhecer meu sorriso");
    expect(appSource).toContain("Foto guiada");
    expect(appSource).toContain("Primeira descoberta");
    expect(appSource).toContain("Mapa do Sorriso");
  });

  it("mantém câmera e consentimento na confirmação da foto", () => {
    expect(cameraSource).toContain("navigator.mediaDevices.getUserMedia");
    expect(cameraSource).toContain("FaceLandmarker.createFromOptions");
    expect(cameraSource).toContain("Nenhum quadro do vídeo é enviado ou salvo");
    expect(cameraSource).toContain('capture="user"');
    expect(journeySource).toContain("preparePhotoFile(file)");
    expect(journeySource).not.toContain("new FileReader()");
    expect(journeySource).toContain("Sua foto está pronta?");
    expect(journeySource).toContain("Continuar com esta foto");
    expect(journeySource).toContain("processamento temporário desta foto");
  });

  it("não exibe o código interno bruto quando a Function de IA falha", () => {
    const apiSource = readFileSync("services/sorvyApi.ts", "utf8");

    expect(apiSource).toContain('maybeMessage === "internal"');
    expect(apiSource).toContain("O serviço de análise da foto está indisponível");
  });

  it("mantém preview antes da captura do contato", () => {
    expect(journeySource.indexOf('setStage("preview")')).toBeLessThan(
      journeySource.indexOf('setStage("contact")'),
    );
    expect(journeySource).toContain("Sem dados pessoais");
    expect(journeySource).toContain("WhatsApp com DDD");
  });

  it("mantém as duas CTAs finais e registra a escolha do paciente", () => {
    expect(journeySource).toContain("no WhatsApp");
    expect(journeySource).toContain("Prefiro receber o contato");
    expect(journeySource).toContain("recordPatientConversionAction");
    expect(functionsSource).toContain("contactRequestedAtMs");
    expect(functionsSource).toContain("patientOpenedWhatsAppAtMs");
  });

  it("mantém linguagem informativa e não diagnóstica", () => {
    expect(appSource).toContain(
      "Triagem informativa. Não substitui consulta com cirurgião-dentista.",
    );
    expect(journeySource).toContain("Não é diagnóstico");
    expect(journeySource).toContain("não indica urgência");
  });
});
