import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const protectedFiles: Record<string, string> = {
  "services/photoFile.ts": "efb55f11dbd440035e015b0bc5b730e9038839331dbcce946b270f6c59fcba46",
  "functions/src/gemini.ts": "0e9d0eab53205fe7fa8d417df498afe979699f67f3e43eac7cd4b6bcd2708ecc",
};

const journeySource = readFileSync(
  resolve(process.cwd(), "components/PatientJourney.tsx"),
  "utf8",
);

describe("proteção da triagem validada", () => {
  for (const [file, expected] of Object.entries(protectedFiles)) {
    it(`mantém ${file} inalterado`, () => {
      const digest = createHash("sha256")
        .update(readFileSync(resolve(process.cwd(), file)))
        .digest("hex");
      expect(digest).toBe(expected);
    });
  }

  it("preserva os controles críticos da jornada mesmo com evolução de UX", () => {
    expect(journeySource).toContain("preparePhotoFile(file)");
    expect(journeySource).toContain("adultAndOwnershipConfirmed: true");
    expect(journeySource).toContain("photoConsent: true");
    expect(journeySource).toContain("processamento temporário para gerar a leitura do sorriso");
    expect(journeySource).toContain("Não é diagnóstico e não substitui consulta");
    expect(journeySource).toContain("recordPatientConversionAction");
    expect(journeySource).toContain("a imagem não ficará no painel");
  });
});
