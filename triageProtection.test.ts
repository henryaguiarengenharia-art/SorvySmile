import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const protectedFiles: Record<string, string> = {
  "components/PatientJourney.tsx": "186de247183524a31d078c6c901c284686b42363c0638aa20bcd32701f9b1d15",
  "services/photoFile.ts": "efb55f11dbd440035e015b0bc5b730e9038839331dbcce946b270f6c59fcba46",
  "functions/src/gemini.ts": "0e9d0eab53205fe7fa8d417df498afe979699f67f3e43eac7cd4b6bcd2708ecc",
};

describe("proteção da triagem validada", () => {
  for (const [file, expected] of Object.entries(protectedFiles)) {
    it(`mantém ${file} inalterado`, () => {
      const digest = createHash("sha256").update(readFileSync(resolve(process.cwd(), file))).digest("hex");
      expect(digest).toBe(expected);
    });
  }
});
