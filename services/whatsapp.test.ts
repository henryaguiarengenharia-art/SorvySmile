import { describe, expect, it } from "vitest";
import { internationalWhatsAppDigits, whatsappUrl } from "./whatsapp";

describe("links de WhatsApp", () => {
  it("adiciona o código do Brasil ao número com DDD", () => {
    expect(internationalWhatsAppDigits("(31) 99999-9999")).toBe("5531999999999");
    expect(internationalWhatsAppDigits("(31) 3333-4444")).toBe("553133334444");
  });

  it("não duplica um código de país já informado", () => {
    expect(internationalWhatsAppDigits("+55 31 99999-9999")).toBe("5531999999999");
  });

  it("codifica a mensagem sem alterar o destino", () => {
    expect(whatsappUrl("31999999999", "Olá, tudo bem?")).toBe(
      "https://wa.me/5531999999999?text=Ol%C3%A1%2C%20tudo%20bem%3F",
    );
  });

  it("não cria link quando o número está vazio", () => {
    expect(whatsappUrl("", "Olá")).toBe("");
  });
});
