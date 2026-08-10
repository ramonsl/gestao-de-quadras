import { describe, it, expect, vi } from "vitest";
import {
  listCustomerComandas,
  listCustomerClassBalances,
  getCustomerOptInStatus,
  getCustomerProfile360,
} from "./customer-profile.service";
import type { TenantContext } from "../db/tenant";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const ACTOR_ID = "22222222-2222-2222-2222-222222222222";
const CUSTOMER_ID = "33333333-3333-3333-3333-333333333333";
const GLOBAL_ID = "44444444-4444-4444-4444-444444444444";

/** FIFO: responde as chamadas a `.execute` na ordem enfileirada (queries sequenciais). */
function mkQueueCtx(responses: unknown[][]): TenantContext {
  const queue = [...responses];
  return {
    tenantId: TENANT_ID,
    actorUserId: ACTOR_ID,
    db: {
      execute: vi.fn().mockImplementation(async () => {
        if (queue.length === 0) throw new Error("mkQueueCtx: fila esgotada");
        return { rows: queue.shift() };
      }),
    },
  } as unknown as TenantContext;
}

/** Extrai o texto SQL de um objeto `sql` da drizzle (junta os StringChunks). */
function sqlText(sqlObj: unknown): string {
  const chunks =
    (sqlObj as { queryChunks?: Array<{ value?: string[] }> } | undefined)?.queryChunks ?? [];
  return chunks
    .map((c) => (Array.isArray(c?.value) ? c.value.join("") : ""))
    .join(" ")
    .toLowerCase();
}

/**
 * Mock que despacha por conteúdo do SQL (robusto ao `Promise.all` do agregador,
 * cuja ordem de chamadas é não-determinística).
 */
function mkMatchCtx(handlers: Array<{ match: RegExp; rows: unknown[] }>): TenantContext {
  return {
    tenantId: TENANT_ID,
    actorUserId: ACTOR_ID,
    db: {
      execute: vi.fn().mockImplementation(async (q: unknown) => {
        const text = sqlText(q);
        const handler = handlers.find((h) => h.match.test(text));
        if (!handler) throw new Error(`mkMatchCtx: sem handler para SQL: ${text}`);
        return { rows: handler.rows };
      }),
    },
  } as unknown as TenantContext;
}

function makeCustomerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CUSTOMER_ID,
    tenant_id: TENANT_ID,
    global_customer_id: GLOBAL_ID,
    whatsapp: "+5511999998888",
    name: "Maria Oliveira",
    email: "maria@example.com",
    birth_date: "1990-08-15",
    status: "active",
    created_by_user_id: ACTOR_ID,
    created_at: new Date("2026-01-01T10:00:00Z"),
    updated_at: new Date("2026-01-01T10:00:00Z"),
    ...overrides,
  };
}

function makeDebitRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "deb-1",
    tenant_id: TENANT_ID,
    customer_id: CUSTOMER_ID,
    comanda_id: "com-1",
    amount_cents: 5000,
    paid_cents: 0,
    status: "pending",
    operator_user_id: ACTOR_ID,
    created_at: new Date("2026-07-01T10:00:00Z"),
    updated_at: new Date("2026-07-01T10:00:00Z"),
    ...overrides,
  };
}

const POINTS_SETTINGS_ENABLED = {
  id: "ps-1",
  tenant_id: TENANT_ID,
  enabled: true,
  earn_rate_cents_per_point: 100,
  redemption_points_per_real: 100,
  max_redemption_percentage: 50,
  allowed_participants: "all",
  expiration_days: 180,
};

describe("customer-profile.service (CAD-08)", () => {
  describe("listCustomerComandas", () => {
    it("retorna vazio quando o cliente não tem comandas", async () => {
      const ctx = mkQueueCtx([[]]);
      const result = await listCustomerComandas(ctx, CUSTOMER_ID);
      expect(result).toEqual([]);
    });

    it("agrega total por snapshot e mapeia meios de pagamento distintos", async () => {
      const ctx = mkQueueCtx([
        // agg
        [
          { id: "com-1", status: "closed", created_at: new Date("2026-07-10T12:00:00Z"), item_count: "2", total_cents: "5000" },
          { id: "com-2", status: "open", created_at: new Date("2026-07-05T12:00:00Z"), item_count: "1", total_cents: "3000" },
        ],
        // payment methods
        [
          { comanda_id: "com-1", payment_method: "pix" },
          { comanda_id: "com-1", payment_method: "dinheiro" },
        ],
      ]);
      const result = await listCustomerComandas(ctx, CUSTOMER_ID);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: "com-1", status: "closed", itemCount: 2, totalCents: 5000 });
      expect(result[0].paymentMethods.sort()).toEqual(["dinheiro", "pix"]);
      expect(result[1]).toMatchObject({ id: "com-2", status: "open", totalCents: 3000, paymentMethods: [] });
    });
  });

  describe("listCustomerClassBalances", () => {
    it("retorna vazio (sem query) quando não há identidade global", async () => {
      const execute = vi.fn();
      const ctx = { tenantId: TENANT_ID, db: { execute } } as unknown as TenantContext;
      const result = await listCustomerClassBalances(ctx, null);
      expect(result).toEqual([]);
      expect(execute).not.toHaveBeenCalled();
    });

    it("mapeia os pacotes de aulas do cliente", async () => {
      const ctx = mkQueueCtx([
        [
          {
            package_name: "Pacote 8 aulas",
            remaining_classes: "3",
            total_class_count: "8",
            purchased_at: new Date("2026-06-01T10:00:00Z"),
            expires_at: null,
          },
        ],
      ]);
      const result = await listCustomerClassBalances(ctx, GLOBAL_ID);
      expect(result).toEqual([
        {
          packageName: "Pacote 8 aulas",
          remainingClasses: 3,
          totalClassCount: 8,
          purchasedAt: new Date("2026-06-01T10:00:00Z"),
          expiresAt: null,
        },
      ]);
    });
  });

  describe("getCustomerOptInStatus", () => {
    it("retorna não-consentido quando não há registro", async () => {
      const ctx = mkQueueCtx([[]]);
      const result = await getCustomerOptInStatus(ctx, CUSTOMER_ID);
      expect(result).toEqual({ optIn: false, changedAt: null });
    });

    it("retorna consentido quando há registro opt_in", async () => {
      const changedAt = new Date("2026-05-01T10:00:00Z");
      const ctx = mkQueueCtx([[{ opt_in: true, changed_at: changedAt }]]);
      const result = await getCustomerOptInStatus(ctx, CUSTOMER_ID);
      expect(result).toEqual({ optIn: true, changedAt });
    });
  });

  describe("getCustomerProfile360", () => {
    it("retorna null quando o cliente não pertence ao tenant (guarda IDOR)", async () => {
      // getCustomerById não encontra → curto-circuito antes das agregações.
      const ctx = mkQueueCtx([[]]);
      const result = await getCustomerProfile360(ctx, CUSTOMER_ID);
      expect(result).toBeNull();
    });

    it("consolida saldos, marca bloqueio ao atingir o limite e conta LTV só de comandas fechadas", async () => {
      const ctx = mkMatchCtx([
        { match: /customer_opt_in_lgpd/, rows: [{ opt_in: true, changed_at: new Date("2026-05-01T10:00:00Z") }] },
        {
          match: /from customer_debits/,
          rows: [
            makeDebitRow({ id: "deb-1", amount_cents: 15000, paid_cents: 0 }),
            makeDebitRow({ id: "deb-2", amount_cents: 6000, paid_cents: 0, comanda_id: "com-3" }),
          ],
        },
        { match: /from points_settings/, rows: [POINTS_SETTINGS_ENABLED] },
        { match: /from customer_points_balance/, rows: [{ balance: 1500 }] },
        {
          match: /from student_class_balance/,
          rows: [
            {
              package_name: "Pacote 8 aulas",
              remaining_classes: "3",
              total_class_count: "8",
              purchased_at: new Date("2026-06-01T10:00:00Z"),
              expires_at: null,
            },
          ],
        },
        { match: /from comanda_payments/, rows: [{ comanda_id: "com-1", payment_method: "pix" }] },
        {
          match: /from comandas c/,
          rows: [
            { id: "com-1", status: "closed", created_at: new Date("2026-07-10T12:00:00Z"), item_count: "2", total_cents: "5000" },
            { id: "com-2", status: "open", created_at: new Date("2026-07-05T12:00:00Z"), item_count: "1", total_cents: "3000" },
          ],
        },
        { match: /from customers /, rows: [makeCustomerRow()] },
      ]);

      const profile = await getCustomerProfile360(ctx, CUSTOMER_ID, new Date("2026-08-08T00:00:00Z"));
      expect(profile).not.toBeNull();
      if (!profile) return;

      // Saldo devedor: 15000 + 6000 = 21000 ≥ limite 20000 → bloqueado.
      expect(profile.debit.totalPendingCents).toBe(21000);
      expect(profile.debit.limitCents).toBe(20000);
      expect(profile.debit.isBlocked).toBe(true);
      expect(profile.debit.usagePercent).toBe(105);
      expect(profile.debit.pendingDebits).toHaveLength(2);

      // Pontos.
      expect(profile.points.enabled).toBe(true);
      expect(profile.points.balancePoints).toBe(1500);
      expect(profile.points.balanceValueCents).toBe(1500);

      // Aulas.
      expect(profile.classBalances).toHaveLength(1);
      expect(profile.classBalances[0].remainingClasses).toBe(3);

      // LTV: só comanda fechada (5000); rentalCount = 0 (sem RES-01).
      expect(profile.ltv.totalSpentCents).toBe(5000);
      expect(profile.ltv.comandaCount).toBe(2);
      expect(profile.ltv.rentalCount).toBe(0);

      // Aniversariante do mês (nasc. 08, now 08).
      expect(profile.isBirthdayThisMonth).toBe(true);
      expect(profile.optIn.optIn).toBe(true);
    });

    it("não marca bloqueio quando o saldo devedor está abaixo do limite", async () => {
      const ctx = mkMatchCtx([
        { match: /customer_opt_in_lgpd/, rows: [] },
        { match: /from customer_debits/, rows: [makeDebitRow({ amount_cents: 5000, paid_cents: 0 })] },
        { match: /from points_settings/, rows: [] },
        { match: /from customer_points_balance/, rows: [] },
        { match: /from student_class_balance/, rows: [] },
        { match: /from comanda_payments/, rows: [] },
        { match: /from comandas c/, rows: [] },
        { match: /from customers /, rows: [makeCustomerRow({ global_customer_id: null })] },
      ]);

      const profile = await getCustomerProfile360(ctx, CUSTOMER_ID, new Date("2026-08-08T00:00:00Z"));
      expect(profile?.debit.isBlocked).toBe(false);
      expect(profile?.debit.usagePercent).toBe(25);
      expect(profile?.points.enabled).toBe(false);
      expect(profile?.classBalances).toEqual([]);
      expect(profile?.ltv.totalSpentCents).toBe(0);
    });
  });
});
