import { describe, expect, it } from "vitest";
import {
  instagramProfileUrl,
  isValidPublicProfessionalName,
  normalizeInstagramHandle,
  normalizePublicHttpsUrl,
  publicProfessionalName,
} from "./publicProfessionalIdentity";

describe("identidade pública profissional", () => {
  it("nunca expõe e-mail como nome público", () => {
    expect(publicProfessionalName("000.henry@gmail.com")).toBe("Profissional responsável");
    expect(isValidPublicProfessionalName("000.henry@gmail.com")).toBe(false);
    expect(publicProfessionalName("Dra. Helena Costa")).toBe("Dra. Helena Costa");
  });

  it("aceita usuário ou URL completa do Instagram", () => {
    expect(normalizeInstagramHandle("@drahelena")).toBe("drahelena");
    expect(normalizeInstagramHandle("https://www.instagram.com/drahelena/" )).toBe("drahelena");
    expect(instagramProfileUrl("@drahelena")).toBe("https://instagram.com/drahelena");
  });

  it("normaliza o site externo para https", () => {
    expect(normalizePublicHttpsUrl("clinica.example.com")).toBe("https://clinica.example.com");
    expect(normalizePublicHttpsUrl("http://clinica.example.com")).toBe("https://clinica.example.com");
  });
});
