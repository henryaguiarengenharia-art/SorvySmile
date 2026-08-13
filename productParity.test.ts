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
const presentationSource = readFileSync(
  new URL("./services/smilePresentation.ts", import.meta.url),
  "utf8",
);

describe("paridade do produto Sorvy Smile", () => {
  it("mantém a página inicial orientada à triagem do paciente", () => {
    expect(appSource).toContain("Descubra o potencial do seu");
    expect(appSource).toContain("Mapear meu sorriso agora");
    expect(appSource).toContain("Foto guiada");
    expect(appSource).toContain("Primeira descoberta");
    expect(appSource).toContain("Mapa do Sorriso");
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

  it("mantém preview antes da captura do contato", () => {
    expect(journeySource.indexOf('setStage("preview")')).toBeLessThan(
      journeySource.indexOf('setStage("contact")'),
    );
    expect(journeySource).toContain("Sem dados pessoais");
    expect(journeySource).toContain("Principal achado visual");
    expect(journeySource).toContain("Harmonia do sorriso");
    expect(journeySource).toContain("Refletividade");
    expect(journeySource).toContain("Classificação VITA");
    expect(journeySource).toContain("Classificação VITA estimada");
    expect(journeySource).toContain("vitaToneDescription");
    expect(journeySource).toContain("Brilho geral");
    expect(journeySource).toContain("WhatsApp com DDD");
  });

  it("mantém a tela de processamento dentro da altura visível", () => {
    expect(journeySource).toContain("h-[calc(100dvh-4rem)]");
    expect(journeySource).toContain("overflow-hidden");
    expect(journeySource).toContain("sm:h-32 sm:w-32");
  });

  it("mantém as duas CTAs finais e registra a escolha do paciente", () => {
    expect(journeySource).toContain("Quero avaliar como melhorar meu sorriso");
    expect(journeySource).toContain("Prefiro que ${profile.name} fale comigo");
    expect(journeySource).toContain("recordPatientConversionAction");
    expect(functionsSource).toContain("contactRequestedAtMs");
    expect(functionsSource).toContain("patientOpenedWhatsAppAtMs");
  });

  it("mantém linguagem objetiva sem transformar imagem em diagnóstico", () => {
    expect(appSource).toContain(
      "Triagem informativa. Não substitui consulta com cirurgião-dentista.",
    );
    expect(journeySource).toContain("Não é diagnóstico");
    expect(journeySource).toContain("confirma diagnóstico nem define tratamento");
    expect(presentationSource).toContain("Alterações visuais importantes");
    expect(journeySource).toContain("Especialidade indicada");
    expect(journeySource).toContain("Foco do cuidado");
    expect(journeySource).toContain("Conteúdo gerado por IA");
    expect(journeySource).toContain("sujeito a pequenas variações");
    expect(journeySource).toContain("bg-rose-50");
  });

  it("reutiliza temporariamente a mesma imagem sem armazenar a foto", () => {
    expect(functionsSource).toContain("analysisCache/${analysisCacheId(digest)}");
    expect(functionsSource).toContain("cachedAnalysisScores");
    expect(functionsSource).toContain("ANALYSIS_CACHE_TTL_MS");
    expect(functionsSource).toContain("a imagem");
    expect(functionsSource).toContain("nunca é gravada no cache");
  });
});
