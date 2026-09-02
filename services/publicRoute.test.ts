import { describe, expect, it } from "vitest";
import { publicLandingPresentation } from "./publicRoute";

describe("apresentação da rota profissional", () => {
  it("nunca usa a landing genérica enquanto o perfil carrega", () => {
    expect(publicLandingPresentation("dra-helena", true, false)).toBe(
      "professional-loading",
    );
  });

  it("mostra a vitrine somente depois de receber o perfil", () => {
    expect(publicLandingPresentation("dra-helena", false, true)).toBe(
      "professional-profile",
    );
  });

  it("mostra um estado indisponível específico quando o link não existe", () => {
    expect(publicLandingPresentation("link-invalido", false, false)).toBe(
      "professional-unavailable",
    );
  });

  it("preserva a landing institucional quando não existe slug", () => {
    expect(publicLandingPresentation(null, false, false)).toBe("generic");
  });
});
