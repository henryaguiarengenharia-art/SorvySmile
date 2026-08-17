import { describe, expect, it } from "vitest";
import { assertSlugAllowed } from "./slug.js";

describe("public slugs", () => {
  it("blocks product routes and accepts professional addresses", () => {
    expect(() => assertSlugAllowed("admin")).toThrow("reservado");
    expect(() => assertSlugAllowed("clinica-saude-integrada-bh")).not.toThrow();
  });
});
