import { describe, it, expect } from "vitest";
import { getCourtsByTenant, getCourtById, createCourt } from "./court.service";

const ctx = (rowSets: unknown[][]) => {
  let i = 0;
  return {
    db: { execute: async () => ({ rows: rowSets[i++] ?? [] }) },
    tenantId: "11111111-1111-1111-1111-111111111111",
    actorUserId: "user-1",
  } as any;
};

const courtRow = (over: Record<string, unknown> = {}) => ({
  id: "c1",
  name: "Quadra 1",
  modality: "Padel",
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
  ...over,
});

describe("Court Service", () => {
  it("rejeita tenant_id inválido", async () => {
    await expect(getCourtsByTenant({ db: {}, tenantId: "x" } as any)).rejects.toThrow(
      /tenant_id inválido/i
    );
  });

  it("lista quadras mapeando is_active -> isActive", async () => {
    const result = await getCourtsByTenant(ctx([[courtRow(), courtRow({ id: "c2" })]]));
    expect(result).toHaveLength(2);
    expect(result[0].isActive).toBe(true);
    expect(result[0].name).toBe("Quadra 1");
  });

  it("busca quadra por id", async () => {
    const result = await getCourtById(ctx([[courtRow()]]), "c1");
    expect(result?.id).toBe("c1");
  });

  it("retorna null quando a quadra não existe", async () => {
    const result = await getCourtById(ctx([[]]), "nope");
    expect(result).toBeNull();
  });

  it("cria quadra", async () => {
    const result = await createCourt(ctx([[courtRow()]]), { name: "Quadra 1", modality: "Padel" });
    expect(result.id).toBe("c1");
    expect(result.modality).toBe("Padel");
  });
});
