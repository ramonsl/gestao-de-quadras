import { describe, it, expect } from "vitest";
import { getClassPackages, createClassPackage } from "./class-package.service";

const ctx = (rowSets: unknown[][]) => {
  let i = 0;
  return {
    db: { execute: async () => ({ rows: rowSets[i++] ?? [] }) },
    tenantId: "11111111-1111-1111-1111-111111111111",
    actorUserId: "user-1",
  } as any;
};

const packageRow = (over: Record<string, unknown> = {}) => ({
  id: "pk1",
  name: "Mensal 8 aulas",
  total_class_count: 8,
  price_in_cents: 32000,
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
  ...over,
});

describe("Class Package Service", () => {
  it("rejeita tenant_id inválido", async () => {
    await expect(getClassPackages({ db: {}, tenantId: "x" } as any)).rejects.toThrow(
      /tenant_id inválido/i
    );
  });

  it("lista pacotes mapeando snake -> camel", async () => {
    const result = await getClassPackages(ctx([[packageRow()]]));
    expect(result[0].totalClassCount).toBe(8);
    expect(result[0].priceInCents).toBe(32000);
    expect(result[0].isActive).toBe(true);
  });

  it("cria pacote de aulas", async () => {
    const result = await createClassPackage(ctx([[packageRow()]]), {
      name: "Mensal 8 aulas",
      totalClassCount: 8,
      priceInCents: 32000,
    });
    expect(result.id).toBe("pk1");
    expect(result.name).toBe("Mensal 8 aulas");
  });
});
