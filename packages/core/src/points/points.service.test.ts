import { describe, it, expect } from "vitest";
import type { TenantContext } from "../db/tenant";
import {
  getPointsSettings,
  upsertPointsSettings,
  getCustomerPointsSummary,
  redeemPoints,
} from "./points.service";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "22222222-2222-4222-8222-222222222222";
const CUSTOMER_ID = "33333333-3333-4333-8333-333333333333";
const REFERENCE_ID = "44444444-4444-4444-8444-444444444444";

function mkQueueCtx(queryResults: unknown[][], overrides: Partial<TenantContext> = {}): TenantContext {
  const queue = [...queryResults];
  return {
    db: {
      execute: async () => {
        const next = queue.shift();
        if (next === undefined) {
          throw new Error("MOCK DB: query chamada além do esperado");
        }
        return { rows: next };
      },
    } as unknown as TenantContext["db"],
    tenantId: TENANT_ID,
    actorUserId: ACTOR_ID,
    ...overrides,
  };
}

describe("points.service", () => {
  describe("getPointsSettings", () => {
    it("retorna configurações padrão quando não existe registro no banco (enabled: false)", async () => {
      const ctx = mkQueueCtx([[]]);
      const res = await getPointsSettings(ctx);

      expect(res.enabled).toBe(false);
      expect(res.earnRateCentsPerPoint).toBe(100);
      expect(res.redemptionPointsPerReal).toBe(100);
      expect(res.maxRedemptionPercentage).toBe(50);
    });

    it("retorna configurações cadastradas quando existem no banco", async () => {
      const ctx = mkQueueCtx([
        [
          {
            id: "setting-1",
            tenant_id: TENANT_ID,
            enabled: true,
            earn_rate_cents_per_point: 200,
            redemption_points_per_real: 100,
            max_redemption_percentage: 40,
            allowed_participants: "all",
            expiration_days: 90,
          },
        ],
      ]);
      const res = await getPointsSettings(ctx);

      expect(res.enabled).toBe(true);
      expect(res.earnRateCentsPerPoint).toBe(200);
      expect(res.maxRedemptionPercentage).toBe(40);
      expect(res.expirationDays).toBe(90);
    });
  });

  describe("upsertPointsSettings", () => {
    it("salva/atualiza as configurações de pontos da arena", async () => {
      const ctx = mkQueueCtx([
        [
          {
            id: "setting-1",
            tenant_id: TENANT_ID,
            enabled: true,
            earn_rate_cents_per_point: 100,
            redemption_points_per_real: 100,
            max_redemption_percentage: 50,
            allowed_participants: "all",
            expiration_days: 180,
          },
        ],
      ]);

      const res = await upsertPointsSettings(ctx, {
        enabled: true,
        earnRateCentsPerPoint: 100,
        redemptionPointsPerReal: 100,
        maxRedemptionPercentage: 50,
        allowedParticipants: "all",
        expirationDays: 180,
      });

      expect(res.enabled).toBe(true);
      expect(res.tenantId).toBe(TENANT_ID);
    });
  });

  describe("getCustomerPointsSummary", () => {
    it("retorna enabled: false se o programa de pontos estiver desativado", async () => {
      const ctx = mkQueueCtx([[]]); // getPointsSettings devolve default (disabled)

      const summary = await getCustomerPointsSummary(ctx, CUSTOMER_ID, 10000);

      expect(summary.enabled).toBe(false);
      expect(summary.maxAllowedRedemptionCents).toBe(0);
      expect(summary.maxAllowedPoints).toBe(0);
    });

    it("calcula o valor dos pontos e o limite máximo de resgate respeitando a porcentagem limite", async () => {
      const ctx = mkQueueCtx([
        [
          {
            id: "setting-1",
            tenant_id: TENANT_ID,
            enabled: true,
            earn_rate_cents_per_point: 100,
            redemption_points_per_real: 100, // 100 pontos = R$ 1,00 (100 centavos)
            max_redemption_percentage: 50,  // máx 50% da comanda
            allowed_participants: "all",
            expiration_days: 180,
          },
        ],
        [{ balance: 800 }], // Cliente tem 800 pontos = R$ 8,00 (800 centavos)
      ]);

      // Comanda de R$ 10,00 (1000 centavos). Máx 50% = R$ 5,00 (500 centavos = 500 pontos).
      const summary = await getCustomerPointsSummary(ctx, CUSTOMER_ID, 1000);

      expect(summary.enabled).toBe(true);
      expect(summary.balancePoints).toBe(800);
      expect(summary.balanceValueCents).toBe(800);
      expect(summary.maxAllowedRedemptionCents).toBe(500);
      expect(summary.maxAllowedPoints).toBe(500);
    });

    it("limita ao saldo do cliente se o limite da comanda for maior que o saldo", async () => {
      const ctx = mkQueueCtx([
        [
          {
            id: "setting-1",
            tenant_id: TENANT_ID,
            enabled: true,
            earn_rate_cents_per_point: 100,
            redemption_points_per_real: 100,
            max_redemption_percentage: 50,
            allowed_participants: "all",
            expiration_days: 180,
          },
        ],
        [{ balance: 200 }], // Cliente tem 200 pontos = R$ 2,00 (200 centavos)
      ]);

      // Comanda de R$ 10,00 (1000 centavos). Máx 50% = R$ 5,00. Mas cliente só tem R$ 2,00.
      const summary = await getCustomerPointsSummary(ctx, CUSTOMER_ID, 1000);

      expect(summary.balancePoints).toBe(200);
      expect(summary.maxAllowedRedemptionCents).toBe(200);
      expect(summary.maxAllowedPoints).toBe(200);
    });
  });

  describe("redeemPoints", () => {
    it("rejeita resgate se o saldo for insuficiente", async () => {
      const ctx = mkQueueCtx([
        [{ balance: 100 }], // Cliente tem 100 pontos
      ]);

      const res = await redeemPoints(ctx, CUSTOMER_ID, 500, REFERENCE_ID);

      expect(res.success).toBe(false);
      expect(res.pointsRedeemed).toBe(0);
      expect(res.remainingBalance).toBe(100);
    });

    it("efetua resgate com sucesso, decrementa saldo e gera extrato", async () => {
      const ctx = mkQueueCtx([
        [{ balance: 1000 }], // SELECT balance
        [],                  // INSERT ON CONFLICT balance
        [],                  // INSERT transaction
      ]);

      const res = await redeemPoints(ctx, CUSTOMER_ID, 300, REFERENCE_ID);

      expect(res.success).toBe(true);
      expect(res.pointsRedeemed).toBe(300);
      expect(res.remainingBalance).toBe(700);
    });
  });
});
