import { describe, expect, it } from "vitest";
import { createStoredZip } from "./storedZip";

describe("arquivo ZIP do carrossel", () => {
  it("gera um ZIP armazenado com diretório central e os nomes esperados", () => {
    const output = createStoredZip([
      { name: "01-capa.png", data: new Uint8Array([1, 2, 3]) },
      { name: "02-conteudo.png", data: new Uint8Array([4, 5]) },
    ]);
    const view = new DataView(output.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034B50);
    expect(new TextDecoder().decode(output)).toContain("01-capa.png");
    expect(new TextDecoder().decode(output)).toContain("02-conteudo.png");
    expect(view.getUint32(output.length - 22, true)).toBe(0x06054B50);
    expect(view.getUint16(output.length - 12, true)).toBe(2);
  });

  it("rejeita um pacote vazio", () => {
    expect(() => createStoredZip([])).toThrow(/conteúdo/);
  });
});
