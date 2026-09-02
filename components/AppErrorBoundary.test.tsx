import { describe, expect, it } from "vitest";
import { AppErrorBoundary } from "./AppErrorBoundary";

describe("recuperação global da interface", () => {
  it("ativa a tela segura quando um componente falha", () => {
    expect(AppErrorBoundary.getDerivedStateFromError()).toEqual({ failed: true });
  });
});
