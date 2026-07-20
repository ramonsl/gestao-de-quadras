import { describe, it, expect } from "vitest";
import { getCourtServices, createCourtService } from "./court-service.service";

const ctx = (rowSets: unknown[][]) => {
  let i = 0;
  return {
    db: { execute: async () => ({ rows: rowSets[i++] ?? [] }) },
    schemaName: "tenant_arena-x",
    actorUserId: "user-1",
  } as any;
};

const serviceRow = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  court_id: "c1",
  service_type: "rental",
  base_price_in_cents: 8000,
  created_at: new Date(),
  updated_at: new Date(),
  ...over,
});

describe("Court Service (serviços)", () => {
  it("rejeita schema de tenant inválido", async () => {
    await expect(getCourtServices({ db: {}, schemaName: "x" } as any, "c1")).rejects.toThrow(
      /schema de tenant inválido/i
    );
  });

  it("lista serviços de uma quadra mapeando snake -> camel", async () => {
    const result = await getCourtServices(ctx([[serviceRow()]]), "c1");
    expect(result).toHaveLength(1);
    expect(result[0].courtId).toBe("c1");
    expect(result[0].basePriceInCents).toBe(8000);
  });

  it("cria serviço", async () => {
    const result = await createCourtService(ctx([[serviceRow()]]), {
      courtId: "c1",
      serviceType: "rental",
      basePriceInCents: 8000,
    });
    expect(result.id).toBe("s1");
    expect(result.serviceType).toBe("rental");
  });
});
