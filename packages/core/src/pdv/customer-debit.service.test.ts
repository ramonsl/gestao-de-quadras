import { describe, it, expect, vi } from "vitest";
import {
  getCustomerDebitSummary,
  transferComandaToCustomerDebit,
  settleCustomerDebit,
  CUSTOMER_DEBIT_LIMIT_CENTS,
} from "./customer-debit.service";
import type { TenantContext } from "../db/tenant";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const ACTOR_ID = "22222222-2222-2222-2222-222222222222";
const CUSTOMER_ID = "33333333-3333-3333-3333-333333333333";
const COMANDA_ID = "44444444-4444-4444-4444-444444444444";
const DEBIT_ID = "55555555-5555-5555-5555-555555555555";

function mkQueueCtx(responses: unknown[][]): TenantContext {
  const queue = [...responses];
  let callCount = 0;
  return {
    tenantId: TENANT_ID,
    actorUserId: ACTOR_ID,
    db: {
      execute: vi.fn().mockImplementation(async () => {
        callCount += 1;
        if (queue.length === 0) {
          throw new Error(
            `mkQueueCtx: fila de respostas esgotada na chamada #${callCount} a .execute()`
          );
        }
        const item = queue.shift();
        return { rows: item };
      }),
    },
  } as unknown as TenantContext;
}

function makeDebitRow(overrides: Record<string, unknown> = {}) {
  return {
    id: DEBIT_ID,
    tenant_id: TENANT_ID,
    customer_id: CUSTOMER_ID,
    comanda_id: COMANDA_ID,
    amount_cents: 5000,
    paid_cents: 0,
    status: "pending",
    operator_user_id: ACTOR_ID,
    created_at: new Date("2026-07-22T10:00:00Z"),
    updated_at: new Date("2026-07-22T10:00:00Z"),
    ...overrides,
  };
}

describe("customer-debit.service (PDV-11)", () => {
  describe("getCustomerDebitSummary", () => {
    it("retorna o total de débito pendente e a lista de débitos", async () => {
      const ctx = mkQueueCtx([
        [
          makeDebitRow({ amount_cents: 5000, paid_cents: 1000 }),
          makeDebitRow({ id: "deb-2", amount_cents: 3000, paid_cents: 0 }),
        ],
      ]);

      const summary = await getCustomerDebitSummary(ctx, CUSTOMER_ID);

      expect(summary.totalPendingCents).toBe(7000);
      expect(summary.pendingDebits).toHaveLength(2);
    });
  });

  describe("transferComandaToCustomerDebit", () => {
    it("falha se a comanda estiver fechada", async () => {
      const ctx = mkQueueCtx([
        // getComandaWithItems -> SELECT comanda + customer
        [
          {
            id: COMANDA_ID,
            tenant_id: TENANT_ID,
            customer_id: CUSTOMER_ID,
            status: "closed",
            opened_by_user_id: ACTOR_ID,
            created_at: new Date(),
            customer_name: "Maria",
            customer_whatsapp: "+5511999999999",
          },
        ],
        // getComandaWithItems -> SELECT items
        [],
        // getComandaWithItems -> SELECT payments
        [],
      ]);

      const res = await transferComandaToCustomerDebit(ctx, {
        comandaId: COMANDA_ID,
        customerId: CUSTOMER_ID,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.reason).toBe("comanda_closed");
      }
    });

    it("falha se exceder o limite máximo configurado (R$ 200,00)", async () => {
      const ctx = mkQueueCtx([
        // getComandaWithItems -> SELECT comanda + customer
        [
          {
            id: COMANDA_ID,
            tenant_id: TENANT_ID,
            customer_id: CUSTOMER_ID,
            status: "open",
            opened_by_user_id: ACTOR_ID,
            created_at: new Date(),
            customer_name: "Maria",
            customer_whatsapp: "+5511999999999",
          },
        ],
        // getComandaWithItems -> SELECT items
        [
          {
            id: "item-1",
            comanda_id: COMANDA_ID,
            product_id: "prod-1",
            quantity: 1,
            unit_price_cents_at_sale: 15000,
            product_name: "Raquete",
            created_at: new Date(),
          },
        ],
        // getComandaWithItems -> SELECT payments
        [],
        // getCustomerDebitSummary -> SELECT customer_debits (já deve R$ 100)
        [makeDebitRow({ amount_cents: 10000, paid_cents: 0 })],
      ]);

      const res = await transferComandaToCustomerDebit(ctx, {
        comandaId: COMANDA_ID,
        customerId: CUSTOMER_ID,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.reason).toBe("limit_exceeded");
      }
    });

    it("transfere comanda aberta para débito com sucesso", async () => {
      const ctx = mkQueueCtx([
        // getComandaWithItems -> SELECT comanda + customer
        [
          {
            id: COMANDA_ID,
            tenant_id: TENANT_ID,
            customer_id: CUSTOMER_ID,
            status: "open",
            opened_by_user_id: ACTOR_ID,
            created_at: new Date(),
            customer_name: "Maria",
            customer_whatsapp: "+5511999999999",
          },
        ],
        // getComandaWithItems -> SELECT items
        [
          {
            id: "item-1",
            comanda_id: COMANDA_ID,
            product_id: "prod-1",
            quantity: 1,
            unit_price_cents_at_sale: 5000,
            product_name: "Item",
            created_at: new Date(),
          },
        ],
        // getComandaWithItems -> SELECT payments
        [],
        // getCustomerDebitSummary -> SELECT debits existentes (0)
        [],
        // getCurrentOpenCashSession -> SELECT cash_sessions
        [],
        // UPDATE comandas SET status = 'closed'
        [],
        // INSERT comanda_payments ('conta_cliente')
        [],
        // INSERT customer_debits RETURNING
        [makeDebitRow({ amount_cents: 5000 })],
        // audit log
        [],
      ]);

      const res = await transferComandaToCustomerDebit(ctx, {
        comandaId: COMANDA_ID,
        customerId: CUSTOMER_ID,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.customerDebit.amountCents).toBe(5000);
      }
    });
  });

  describe("settleCustomerDebit", () => {
    it("quita o débito do cliente proporcionalmente", async () => {
      const ctx = mkQueueCtx([
        // 1. getCustomerDebitSummary -> SELECT customer_debits
        [makeDebitRow({ amount_cents: 5000, paid_cents: 0 })],
        // 2. getCurrentOpenCashSession -> SELECT cash_sessions
        [],
        // 3. UPDATE customer_debits (paid_cents = 5000, status = 'settled')
        [],
        // 4. INSERT customer_debit_payments
        [
          {
            id: "pay-1",
            tenant_id: TENANT_ID,
            customer_debit_id: DEBIT_ID,
            cash_session_id: null,
            payment_method: "pix",
            amount_cents: 5000,
            operator_user_id: ACTOR_ID,
            created_at: new Date(),
          },
        ],
        // 5. getCustomerDebitSummary pós-quitação -> SELECT customer_debits
        [],
        // 6. audit log
        [],
      ]);

      const res = await settleCustomerDebit(ctx, {
        customerId: CUSTOMER_ID,
        payments: [{ paymentMethod: "pix", amountCents: 5000 }],
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.settledCents).toBe(5000);
        expect(res.remainingDebitCents).toBe(0);
      }
    });
  });

  /**
   * Regressão do refactor boy-scout (CAD-08): a constante `MAX_LIMIT_CENTS`,
   * antes hardcoded no corpo de `transferComandaToCustomerDebit`, foi extraída
   * para `CUSTOMER_DEBIT_LIMIT_CENTS` e passou a ser compartilhada com o Perfil
   * 360°. Estes testes travam o valor (20.000 = R$ 200,00) E provam que é ele o
   * limite efetivamente aplicado na transferência — a fronteira (== limite passa,
   * limite + 1 bloqueia).
   */
  describe("CUSTOMER_DEBIT_LIMIT_CENTS (regressão do limite extraído)", () => {
    /** Monta a fila de execução de uma comanda aberta com um único item. */
    function openComandaQueue(totalCents: number): unknown[][] {
      return [
        // getComandaWithItems -> SELECT comanda + customer
        [
          {
            id: COMANDA_ID,
            tenant_id: TENANT_ID,
            customer_id: CUSTOMER_ID,
            status: "open",
            opened_by_user_id: ACTOR_ID,
            created_at: new Date(),
            customer_name: "Maria",
            customer_whatsapp: "+5511999999999",
          },
        ],
        // getComandaWithItems -> SELECT items (total = quantity * unit_price)
        [
          {
            id: "item-1",
            comanda_id: COMANDA_ID,
            product_id: "prod-1",
            quantity: 1,
            unit_price_cents_at_sale: totalCents,
            product_name: "Item",
            created_at: new Date(),
          },
        ],
        // getComandaWithItems -> SELECT payments
        [],
      ];
    }

    it("expõe o limite fixado em 20.000 centavos (R$ 200,00)", () => {
      expect(CUSTOMER_DEBIT_LIMIT_CENTS).toBe(20000);
    });

    it("permite a transferência quando o saldo devedor resultante é exatamente o limite", async () => {
      const ctx = mkQueueCtx([
        ...openComandaQueue(CUSTOMER_DEBIT_LIMIT_CENTS),
        // getCustomerDebitSummary -> SELECT débitos existentes (0)
        [],
        // getCurrentOpenCashSession -> SELECT cash_sessions
        [],
        // UPDATE comandas SET status = 'closed'
        [],
        // INSERT comanda_payments ('conta_cliente')
        [],
        // INSERT customer_debits RETURNING
        [makeDebitRow({ amount_cents: CUSTOMER_DEBIT_LIMIT_CENTS })],
        // audit log
        [],
      ]);

      const res = await transferComandaToCustomerDebit(ctx, {
        comandaId: COMANDA_ID,
        customerId: CUSTOMER_ID,
      });

      expect(res.success).toBe(true);
    });

    it("bloqueia a transferência que ultrapassa o limite em 1 centavo, reportando CUSTOMER_DEBIT_LIMIT_CENTS", async () => {
      const ctx = mkQueueCtx([
        ...openComandaQueue(CUSTOMER_DEBIT_LIMIT_CENTS + 1),
        // getCustomerDebitSummary -> SELECT débitos existentes (0)
        [],
      ]);

      const res = await transferComandaToCustomerDebit(ctx, {
        comandaId: COMANDA_ID,
        customerId: CUSTOMER_ID,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.reason).toBe("limit_exceeded");
        expect(res.maxLimitCents).toBe(CUSTOMER_DEBIT_LIMIT_CENTS);
      }
    });
  });
});
