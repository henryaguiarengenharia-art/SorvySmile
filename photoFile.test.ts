import { describe, expect, it } from "vitest";
import { bytesToBase64, detectImageMimeType } from "./services/photoFile";

describe("preparação local da foto", () => {
  it("reconhece os formatos aceitos e formatos móveis conversíveis", () => {
    expect(detectImageMimeType(new Uint8Array([0xff, 0xd8, 0xff]))).toBe("image/jpeg");
    expect(
      detectImageMimeType(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe("image/png");
    expect(
      detectImageMimeType(
        new TextEncoder().encode("RIFF0000WEBP"),
      ),
    ).toBe("image/webp");
    expect(
      detectImageMimeType(
        new Uint8Array([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]),
      ),
    ).toBe("image/heic");
  });

  it("gera base64 sem depender de FileReader", () => {
    expect(bytesToBase64(new TextEncoder().encode("Sorvy"))).toBe("U29ydnk=");
  });
});
