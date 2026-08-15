import { describe, it, expect } from "vitest";
import { getActiveBalancesForCustomer, debitOneClass } from "./class-balance.service";
import type { TenantContext } from "../db/tenant";

/**
 * PDV-06 — Venda de Aulas Avulsas e Pacotes.
 *
 * Cobre as funções de saldo de aulas (`class-balance.service.ts`):
 *   - `getActiveBalancesForCustomer` (AC5, AC10)
 *   - `debitOneClass`               (AC6, AC10, AC11)
 *
 * Mock de banco em FILA: cada chamada a `.execute()` consome a próxima resposta.
 * O isolamento de tenant é verificado via comportamento (resultado vazio quando
 * o SQL filtraria linhas de outro tenant) — o mesmo padrão dos demais testes.
 */

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ACTOR_ID = "22222222-2222-4222-8222-222222222222";
const CUSTOMER_ID = "33333333-3333-4333-8333-333333333333";
const BALANCE_ID = "44444444-4444-4444-8444-444444444444";
const PKG_ID = "55555555-5555-4555-8555-555555555555";

function mkQueueCtx(
  responseQueue: unknown[][],
  overrides: Partial<TenantContext> = {}
): TenantContext {
  const queue = [...responseQueue];
  let callCount = 0;
  const db = {
    execute: async () => {
      callCount += 1;
      if (queue.length === 0) {
        throw new Error(
          `mkQueueCtx: fila esgotada na chamada #${callCount} — ` +
            "o teste não previu esta chamada (a função fez mais consultas ao banco do que o esperado)."
        );
      }
      return { rows: queue.shift() };
    },
  };
  return {
    db: db as unknown as TenantContext["db"],
    tenantId: TENANT_A,
    actorUserId: ACTOR_ID,
    ...overrides,
  };
}

function balanceRow(over: Record<string, unknown> = {}) {
  return {
    id: BALANCE_ID,
    tenant_id: TENANT_A,
    global_customer_id: CUSTOMER_ID,
    class_package_id: PKG_ID,
    package_name: "Mensal 8 Aulas",
    remaining_classes: 5,
    purchased_at: new Date("2026-01-01"),
    expires_at: null,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// getActiveBalancesForCustomer
// ---------------------------------------------------------------------------

describe("getActiveBalancesForCustomer (PDV-06 AC5/AC10)", () => {
  it("retorna saldos com remaining_classes > 0 mapeando corretamente (AC5)", async () => {
    const ctx = mkQueueCtx([[balanceRow({ remaining_classes: 3 })]]);

    const result = await getActiveBalancesForCustomer(ctx, CUSTOMER_ID);

    expect(result).toHaveLength(1);
    expect(result[0].remainingClasses).toBe(3);
    expect(result[0].packageName).toBe("Mensal 8 Aulas");
    expect(result[0].classPackageId).toBe(PKG_ID);
    expect(result[0].globalCustomerId).toBe(CUSTOMER_ID);
  });

  it("retorna lista vazia quando o cliente não tem saldo ativo", async () => {
    // Simula BD com filtro WHERE remaining_classes > 0 retornando zero linhas.
    const ctx = mkQueueCtx([[]]);

    const result = await getActiveBalancesForCustomer(ctx, CUSTOMER_ID);

    expect(result).toEqual([]);
  });

  it("não retorna saldos de outro tenant — isolamento por tenant_id (AC10)", async () => {
    // A query inclui WHERE scb.tenant_id = ${ctx.tenantId}.
    // O mock simula que o Postgres NÃO retornou linhas de outros tenants
    // (filtradas pelo WHERE). Com ctx.tenantId = TENANT_A, saldos de TENANT_B
    // nunca aparecem no resultado.
    const ctxA = mkQueueCtx([[]]); // tenant A: cliente sem saldo neste tenant
    const resultA = await getActiveBalancesForCustomer(ctxA, CUSTOMER_ID);
    expect(resultA).toHaveLength(0);

    // Tenant B tem saldo para o mesmo cliente — mas jamais seria visto por tenant A.
    const ctxB = mkQueueCtx([[balanceRow({ tenant_id: TENANT_B })]], {
      tenantId: TENANT_B,
    });
    const resultB = await getActiveBalancesForCustomer(ctxB, CUSTOMER_ID);
    expect(resultB).toHaveLength(1);
    expect(resultB[0].tenantId).toBe(TENANT_B);
  });

  it("rejeita tenantId inválido antes de consultar o banco", async () => {
    const ctx = mkQueueCtx([], { tenantId: "nao-e-uuid" });

    await expect(getActiveBalancesForCustomer(ctx, CUSTOMER_ID)).rejects.toThrow(/tenant_id inválido/i);
  });

  it("mapeia todos os campos snake_case → camelCase corretamente", async () => {
    const purchasedAt = new Date("2026-03-15");
    const expiresAt = new Date("2026-12-31");
    const ctx = mkQueueCtx([
      [balanceRow({ purchased_at: purchasedAt, expires_at: expiresAt, remaining_classes: 7 })],
    ]);

    const [balance] = await getActiveBalancesForCustomer(ctx, CUSTOMER_ID);

    expect(balance.id).toBe(BALANCE_ID);
    expect(balance.tenantId).toBe(TENANT_A);
    expect(balance.purchasedAt).toEqual(purchasedAt);
    expect(balance.expiresAt).toEqual(expiresAt);
    expect(balance.remainingClasses).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// debitOneClass
// ---------------------------------------------------------------------------

describe("debitOneClass (PDV-06 AC6/AC10/AC11)", () => {
  it(
    "retorna balance_not_found quando o balance pertence a outro tenant (IDOR guard) (AC10)",
    async () => {
      // A query inicial usa WHERE id = ... AND tenant_id = ${ctx.tenantId}.
      // Um balance_id de TENANT_B não é encontrado quando ctx.tenantId = TENANT_A.
      const ctx = mkQueueCtx([
        [], // SELECT id, remaining_classes ... WHERE tenant_id = TENANT_A → vazio
      ]);

      const result = await debitOneClass(ctx, { studentClassBalanceId: BALANCE_ID });

      expect(result).toEqual({ success: false, reason: "balance_not_found" });
    }
  );

  it(
    "retorna balance_exhausted quando RETURNING retorna vazio (saldo esgotado) (AC6/AC11)",
    async () => {
      // SELECT inicial encontra o balance (remaining_classes pode ser 0 neste instante).
      // UPDATE com WHERE remaining_classes > 0 não afeta nenhuma linha → RETURNING vazio.
      const ctx = mkQueueCtx([
        [{ id: BALANCE_ID, remaining_classes: 0 }], // SELECT: balance existe no tenant
        [],                                           // UPDATE RETURNING: sem linhas (esgotado)
      ]);

      const result = await debitOneClass(ctx, { studentClassBalanceId: BALANCE_ID });

      expect(result).toEqual({ success: false, reason: "balance_exhausted" });
    }
  );

  it(
    "débito bem-sucedido: insere em class_debit_log e retorna remainingClasses decrementado (AC6/AC11)",
    async () => {
      // 4 chamadas ao banco:
      // 1. SELECT (IDOR guard): balance existe no tenant A, remaining = 3
      // 2. UPDATE RETURNING: decrementa para 2
      // 3. INSERT class_debit_log: auditoria
      // 4. SELECT meta (nome do pacote + whatsapp do cliente)
      const ctx = mkQueueCtx([
        [{ id: BALANCE_ID, remaining_classes: 3 }],                                  // 1. SELECT guard
        [{ id: BALANCE_ID, remaining_classes: 2, global_customer_id: CUSTOMER_ID,   // 2. UPDATE RETURNING
           class_package_id: PKG_ID }],
        [{}],                                                                         // 3. INSERT log
        [{ package_name: "Mensal 8 Aulas", whatsapp: "+5511999990000" }],           // 4. SELECT meta
      ]);

      const result = await debitOneClass(ctx, { studentClassBalanceId: BALANCE_ID });

      expect(result.success).toBe(true);
      if (!result.success) throw new Error("esperava success:true");
      expect(result.remainingClasses).toBe(2);
      expect(result.packageName).toBe("Mensal 8 Aulas");
      expect(result.globalCustomerId).toBe(CUSTOMER_ID);
      expect(result.customerWhatsapp).toBe("+5511999990000");
    }
  );

  it("retorna packageName padrão quando meta não está disponível no banco", async () => {
    // Edge case: JOIN entre class_packages e global_customers retorna vazio.
    const ctx = mkQueueCtx([
      [{ id: BALANCE_ID, remaining_classes: 1 }],
      [{ id: BALANCE_ID, remaining_classes: 0, global_customer_id: CUSTOMER_ID, class_package_id: PKG_ID }],
      [{}],
      [], // meta vazia
    ]);

    const result = await debitOneClass(ctx, { studentClassBalanceId: BALANCE_ID });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("esperava success:true");
    expect(result.packageName).toBe("Pacote de Aulas");
    expect(result.customerWhatsapp).toBeNull();
  });

  it("exige ctx.actorUserId (operador do débito)", async () => {
    const ctx = mkQueueCtx([], { actorUserId: undefined });

    await expect(
      debitOneClass(ctx, { studentClassBalanceId: BALANCE_ID })
    ).rejects.toThrow(/actorUserId/i);
  });

  it("rejeita tenantId inválido antes de consultar o banco", async () => {
    const ctx = mkQueueCtx([], { tenantId: "nao-e-uuid" });

    await expect(
      debitOneClass(ctx, { studentClassBalanceId: BALANCE_ID })
    ).rejects.toThrow(/tenant_id inválido/i);
  });

  it("rejeita studentClassBalanceId que não é UUID (validação de schema)", async () => {
    const ctx = mkQueueCtx([]);

    await expect(
      debitOneClass(ctx, { studentClassBalanceId: "nao-e-uuid" })
    ).rejects.toThrow();
  });
});
