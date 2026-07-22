import { describe, it, expect, vi } from "vitest";
import type { TenantContext } from "../types";
import {
  openCashSession,
  addCashMovement,
  getCashSessionSummary,
  closeCashSession,
  getCurrentOpenCashSession,
} from "./cash-session.service";

const writeAuditMock = vi.fn();
vi.mock("../audit/audit.service", () => ({
  writeAudit: (...args: unknown[]) => writeAuditMock(...args),
}));

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "33333333-3333-4333-8333-333333333333";

function makeSessionRow(overrides: Partial<{ id: string; status: string; initial_cash_cents: number }> = {}) {
  return {
    id: SESSION_ID,
    tenant_id: TENANT_ID,
    operator_user_id: ACTOR_ID,
    closed_by_user_id: null,
    status: "open",
    initial_cash_cents: 10000,
    opened_at: new Date("2026-07-22T10:00:00Z"),
    closed_at: null,
    closing_notes: null,
    ...overrides,
  };
}

function makeMovementRow(overrides: Partial<{ id: string; type: string; amount_cents: number; reason: string }> = {}) {
  return {
    id: "mov-1",
    tenant_id: TENANT_ID,
    cash_session_id: SESSION_ID,
    type: "suprimento",
    amount_cents: 5000,
    reason: "Adicional de troco",
    operator_user_id: ACTOR_ID,
    created_at: new Date("2026-07-22T11:00:00Z"),
    ...overrides,
  };
}

function mkQueueCtx(responses: unknown[][], opts: { actorUserId?: string } = {}): TenantContext {
  const queue = [...responses];
  let callCount = 0;
  return {
    tenantId: TENANT_ID,
    actorUserId: "actorUserId" in opts ? opts.actorUserId : ACTOR_ID,
    db: {
      execute: vi.fn(async () => {
        callCount += 1;
        if (queue.length === 0) {
          throw new Error(
            `mkQueueCtx: fila de respostas esgotada na chamada #${callCount} a .execute().`
          );
        }
        const next = queue.shift()!;
        return { rows: next };
      }),
    } as unknown as TenantContext["db"],
  };
}

function assertSuccess<T extends { success: true }>(
  result: T | { success: false; reason: string }
): asserts result is T {
  if (!result.success) {
    throw new Error(`Esperava sucesso mas recebeu falha com reason=${result.reason}`);
  }
}

function assertFailure<T extends { success: false }>(
  result: T | { success: true }
): asserts result is T {
  if (result.success) {
    throw new Error("Esperava falha mas a operação foi bem-sucedida");
  }
}

describe("cash-session.service", () => {
  describe("getCurrentOpenCashSession", () => {
    it("retorna a sessão aberta atual se existir", async () => {
      const ctx = mkQueueCtx([[makeSessionRow()]]);
      const session = await getCurrentOpenCashSession(ctx);
      expect(session).not.toBeNull();
      expect(session?.id).toBe(SESSION_ID);
      expect(session?.status).toBe("open");
    });

    it("retorna null se não houver caixa aberto", async () => {
      const ctx = mkQueueCtx([[]]);
      const session = await getCurrentOpenCashSession(ctx);
      expect(session).toBeNull();
    });
  });

  describe("openCashSession", () => {
    it("abre novo caixa com saldo inicial com sucesso", async () => {
      const ctx = mkQueueCtx([
        [], // getCurrentOpenCashSession -> null
        [makeSessionRow({ initial_cash_cents: 15000 })], // INSERT
        [{}], // audit
      ]);

      const result = await openCashSession(ctx, { initialCashCents: 15000 });
      assertSuccess(result);
      expect(result.cashSession.initialCashCents).toBe(15000);
      expect(result.cashSession.status).toBe("open");
    });

    it("falha com already_open se já houver um caixa aberto", async () => {
      const ctx = mkQueueCtx([[makeSessionRow()]]);

      const result = await openCashSession(ctx, { initialCashCents: 10000 });
      assertFailure(result);
      expect(result.reason).toBe("already_open");
    });

    it("exige ctx.actorUserId ao abrir o caixa", async () => {
      const ctx = mkQueueCtx([], { actorUserId: undefined });
      await expect(openCashSession(ctx, { initialCashCents: 10000 })).rejects.toThrow(
        /actorUserId/
      );
    });
  });

  describe("addCashMovement", () => {
    it("adiciona sangria com sucesso em caixa aberto", async () => {
      const ctx = mkQueueCtx([
        [makeSessionRow()], // SELECT session
        [makeMovementRow({ type: "sangria", amount_cents: 3000, reason: "Pagamento fornecedor" })], // INSERT
        [{}], // audit
      ]);

      const result = await addCashMovement(ctx, {
        cashSessionId: SESSION_ID,
        type: "sangria",
        amountCents: 3000,
        reason: "Pagamento fornecedor",
      });

      assertSuccess(result);
      expect(result.movement.type).toBe("sangria");
      expect(result.movement.amountCents).toBe(3000);
    });

    it("falha com session_closed se tentar lançar em caixa fechado", async () => {
      const ctx = mkQueueCtx([[makeSessionRow({ status: "closed" })]]);

      const result = await addCashMovement(ctx, {
        cashSessionId: SESSION_ID,
        type: "suprimento",
        amountCents: 2000,
        reason: "Troco extra",
      });

      assertFailure(result);
      expect(result.reason).toBe("session_closed");
    });
  });

  describe("getCashSessionSummary", () => {
    it("calcula corretamente os totais esperados considerando inicial, suprimentos, sangrias e vendas", async () => {
      const ctx = mkQueueCtx([
        [makeSessionRow({ initial_cash_cents: 10000 })], // SELECT session
        [
          makeMovementRow({ type: "suprimento", amount_cents: 5000 }),
          makeMovementRow({ type: "sangria", amount_cents: 2000 }),
        ], // SELECT movements
        [
          { payment_method: "dinheiro", total_amount: "4000", total_change: "1000" }, // líquido R$ 30,00 em dinheiro
          { payment_method: "pix", total_amount: "8000", total_change: "0" }, // R$ 80,00 em pix
        ], // SELECT comanda_payments
        [], // SELECT customer_debit_payments
      ]);

      const summary = await getCashSessionSummary(ctx, SESSION_ID);
      expect(summary).not.toBeNull();
      if (!summary) return;

      // Dinheiro: 100 (inicial) + 50 (suprimento) - 20 (sangria) + 30 (venda líquida) = 160 -> 16000 centavos
      expect(summary.expectedByMethod.dinheiro).toBe(16000);
      expect(summary.expectedByMethod.pix).toBe(8000);
      expect(summary.totalExpectedCents).toBe(24000);
    });
  });

  describe("closeCashSession", () => {
    it("fecha o caixa e calcula a diferença de sobra/quebra por meio de pagamento", async () => {
      const ctx = mkQueueCtx([
        [makeSessionRow({ initial_cash_cents: 10000 })], // SELECT session
        [], // SELECT movements
        [{ payment_method: "dinheiro", total_amount: "5000", total_change: "0" }], // comanda_payments
        [], // customer_debit_payments
        [{ id: "count-1", tenant_id: TENANT_ID, cash_session_id: SESSION_ID, payment_method: "dinheiro", expected_cents: 15000, counted_cents: 15500, difference_cents: 500 }], // INSERT count dinheiro
        [{ id: "count-2", tenant_id: TENANT_ID, cash_session_id: SESSION_ID, payment_method: "pix", expected_cents: 0, counted_cents: 0, difference_cents: 0 }], // INSERT count pix
        [makeSessionRow({ status: "closed", closed_by_user_id: ACTOR_ID })], // UPDATE session status = 'closed'
        [{}], // audit
      ]);

      const result = await closeCashSession(ctx, {
        cashSessionId: SESSION_ID,
        counts: [
          { paymentMethod: "dinheiro", countedCents: 15500 }, // Sobra de R$ 5,00 (500 centavos)
          { paymentMethod: "pix", countedCents: 0 },
        ],
        closingNotes: "Conferido sem pendências",
      });

      assertSuccess(result);
      expect(result.cashSession.status).toBe("closed");
      expect(result.totalDifferenceCents).toBe(500); // Sobra de 500 centavos
      expect(result.counts).toHaveLength(2);
    });
  });
});
