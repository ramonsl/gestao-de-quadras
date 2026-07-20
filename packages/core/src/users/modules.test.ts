import { describe, it, expect } from "vitest";
import { MODULES, MODULE_LABELS, isModuleSlug } from "./modules";

describe("MODULES (SAAS-12)", () => {
  it("expõe os 8 módulos configuráveis por operador", () => {
    expect(MODULES).toHaveLength(8);
    expect([...MODULES]).toEqual([
      "pdv",
      "quadras",
      "crm",
      "filiacao",
      "pontos",
      "publicidade",
      "relatorios",
      "whatsapp",
    ]);
  });

  it("tem rótulo pt-BR para todo slug", () => {
    for (const slug of MODULES) {
      expect(MODULE_LABELS[slug]).toBeTruthy();
    }
  });

  it("isModuleSlug reconhece slugs válidos e rejeita inválidos", () => {
    expect(isModuleSlug("pdv")).toBe(true);
    expect(isModuleSlug("configuracoes")).toBe(false); // Config é exclusivo do Admin
    expect(isModuleSlug("")).toBe(false);
  });
});
