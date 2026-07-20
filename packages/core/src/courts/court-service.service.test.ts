import { describe, it, expect } from "vitest";
import { getCourtServices, createCourtService } from "./court-service.service";

const ctx = (rowSets: unknown[][]) => {
  let i = 0;
  return {
    db: { execute: async () => ({ rows: rowSets[i++] ?? [] }) },
    tenantId: "11111111-1111-1111-1111-111111111111",
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
  it("rejeita tenant_id inválido", async () => {
    await expect(getCourtServices({ db: {}, tenantId: "x" } as any, "c1")).rejects.toThrow(
      /tenant_id inválido/i
    );
  });

  it("lista serviços de uma quadra mapeando snake -> camel", async () => {
    const result = await getCourtServices(ctx([[serviceRow()]]), "c1");
    expect(result).toHaveLength(1);
    expect(result[0].courtId).toBe("c1");
    expect(result[0].basePriceInCents).toBe(8000);
  });

  it("cria serviço (após validar que o court é do tenant)", async () => {
    // 1ª query: checagem anti-IDOR (court existe no tenant) → 2ª: INSERT
    const result = await createCourtService(ctx([[{ id: "c1" }], [serviceRow()]]), {
      courtId: "c1",
      serviceType: "rental",
      basePriceInCents: 8000,
    });
    expect(result.id).toBe("s1");
    expect(result.serviceType).toBe("rental");
  });

  it("rejeita court de outro tenant (anti-IDOR)", async () => {
    // checagem do court não encontra nada no tenant → não insere
    await expect(
      createCourtService(ctx([[]]), {
        courtId: "court-de-outro-tenant",
        serviceType: "rental",
        basePriceInCents: 8000,
      })
    ).rejects.toThrow(/não encontrada nesta arena/i);
  });
});
