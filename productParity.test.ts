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
const v6PresentationSource = readFileSync(
  new URL("./services/smileV6Presentation.ts", import.meta.url),
  "utf8",
);

describe("paridade do produto Sorvy Smile", () => {
  it("mantém a página inicial orientada à triagem do paciente", () => {
    expect(appSource).toContain("Descubra o potencial do seu");
    expect(appSource).toContain("Mapear meu sorriso agora");
    expect(appSource).toContain("Foto guiada");
  });

  it("mantém câmera e consentimento na confirmação da foto", () => {
    expect(cameraSource).toContain("navigator.mediaDevices.getUserMedia");
    expect(cameraSource).toContain("FaceLandmarker.createFromOptions");
    expect(cameraSource).toContain("Nenhum quadro do vídeo é enviado ou salvo");
    expect(cameraSource).toContain("smileCropRect");
    expect(cameraSource).toContain("moldura acompanha apenas a região da boca");
    expect(cameraSource).toContain('capture="user"');
    expect(journeySource).toContain("preparePhotoFile(file)");
    expect(journeySource).not.toContain("new FileReader()");
    expect(journeySource).toContain("Este é o sorriso que vamos analisar?");
    expect(journeySource).toContain("Analisar meu sorriso");
    expect(journeySource).toContain("processamento temporário para gerar a leitura do sorriso");
  });

  it("não exibe o código interno bruto quando a Function de IA falha", () => {
    const apiSource = readFileSync("services/sorvyApi.ts", "utf8");
    expect(apiSource).toContain('maybeMessage === "internal"');
    expect(apiSource).toContain("O serviço de análise da foto está indisponível");
  });

  it("mantém Primeiro Sinal antes da captura do contato", () => {
    expect(journeySource.indexOf('setStage("signal")')).toBeLessThan(
      journeySource.indexOf('setStage("contact")'),
    );
    expect(journeySource).toContain("Primeiro sinal");
    expect(journeySource).toContain("primeiro sinal encontrado");
    expect(journeySource).toContain("A leitura ainda não acabou");
    expect(journeySource).toContain("Ver meu resultado completo");
    expect(journeySource).toContain("WhatsApp com DDD");
  });

  it("mantém resultado completo com dados reais e aprofundamento", () => {
    expect(journeySource).toContain("Seu resultado completo");
    expect(journeySource).toContain("Índice Visual Geral");
    expect(journeySource).toContain("Principal contraste");
    expect(journeySource).toContain("Entender este sinal ↓");
    expect(journeySource).toContain("Tempo relacionado a este sinal");
    expect(v6PresentationSource).toContain('id: "alignment"');
    expect(v6PresentationSource).toContain('id: "brightness"');
    expect(v6PresentationSource).toContain('id: "harmony"');
    expect(v6PresentationSource).toContain('id: "balance"');
  });

  it("mantém a tela de processamento dentro da altura visível", () => {
    expect(journeySource).toContain("h-[calc(100dvh-4rem)]");
    expect(journeySource).toContain("overflow-hidden");
    expect(journeySource).toContain("sm:h-32 sm:w-32");
  });

  it("mantém as duas CTAs finais e registra a escolha do paciente", () => {
    expect(journeySource).toContain("Quero avaliar isso agora");
    expect(journeySource).toContain("Prefiro que ${profile.name} fale comigo");
    expect(journeySource).toContain("recordPatientConversionAction");
    expect(functionsSource).toContain("contactRequestedAtMs");
    expect(functionsSource).toContain("patientOpenedWhatsAppAtMs");
  });

  it("mantém linguagem objetiva sem transformar imagem em diagnóstico", () => {
    expect(appSource).toContain(
      "Triagem informativa. Não substitui consulta com cirurgião-dentista.",
    );
    expect(journeySource).toContain("Não é diagnóstico e não substitui consulta");
    expect(journeySource).toContain("não significa que uma doença foi identificada na foto");
    expect(journeySource).toContain("Diagnóstico, indicação clínica e tratamento permanecem com o dentista");
  });

  it("reutiliza temporariamente a mesma imagem sem armazenar a foto", () => {
    expect(functionsSource).toContain("analysisCache/${analysisCacheId(digest)}");
    expect(functionsSource).toContain("cachedAnalysisScores");
    expect(functionsSource).toContain("ANALYSIS_CACHE_TTL_MS");
    expect(functionsSource).toContain("a imagem");
    expect(functionsSource).toContain("nunca é gravada no cache");
  });
});
