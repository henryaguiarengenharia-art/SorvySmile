import { describe, expect, it } from "vitest";
import {
  buildInfinitePayOrderNsu,
  expectedInfinitePayAmountCents,
  resolveInfinitePayReturnOrigin,
} from "./infinitePay.js";

describe("checkout integrado InfinitePay", () => {
  it("usa os preços oficiais do servidor em centavos", () => {
    expect(expectedInfinitePayAmountCents("lite")).toEqual({
      plan: "lite",
      amountCents: 9700,
    });
    expect(expectedInfinitePayAmountCents("pro")).toEqual({
      plan: "pro",
      amountCents: 19700,
    });
    expect(expectedInfinitePayAmountCents("network")).toEqual({
      plan: "network",
      amountCents: 29700,
    });
  });

  it("gera pedidos opacos e distintos sem expor o identificador da conta", () => {
    const first = buildInfinitePayOrderNsu("acc_usuario-secreto");
    const second = buildInfinitePayOrderNsu("acc_usuario-secreto");
    expect(first).toMatch(/^smile-[a-f0-9]{12}-[a-z0-9]+-[a-f0-9-]{8}$/);
    expect(second).not.toBe(first);
    expect(first).not.toContain("usuario-secreto");
  });

  it("aceita produção, homologação e preview oficial", () => {
    const fallback = "https://sorvysmile-homologacao.web.app";
    expect(resolveInfinitePayReturnOrigin("https://sorvysmile.web.app/planos", fallback))
      .toBe("https://sorvysmile.web.app");
    expect(resolveInfinitePayReturnOrigin("https://sorvysmile-homologacao.web.app", fallback))
      .toBe("https://sorvysmile-homologacao.web.app");
    expect(resolveInfinitePayReturnOrigin(
      "https://sorvysmile-homologacao--migracao-smile-abc.web.app/",
      fallback,
    )).toBe("https://sorvysmile-homologacao--migracao-smile-abc.web.app");
  });

  it("impede redirecionamento para domínio externo ou HTTP", () => {
    const fallback = "https://sorvysmile-homologacao.web.app";
    expect(resolveInfinitePayReturnOrigin("https://evil.example", fallback)).toBe(fallback);
    expect(resolveInfinitePayReturnOrigin("http://sorvysmile.web.app", fallback)).toBe(fallback);
    expect(resolveInfinitePayReturnOrigin("https://user:pass@sorvysmile.web.app", fallback)).toBe(fallback);
  });
});
