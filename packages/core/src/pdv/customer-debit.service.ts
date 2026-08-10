import { z } from "zod";
import { sql } from "drizzle-orm";
import { assertTenantId, rows, type TenantContext } from "../db/tenant";
import { getComandaWithItems } from "./comanda.service";
import { getCurrentOpenCashSession } from "./cash-session.service";
import type { CustomerDebit, CustomerDebitPayment } from "@gestao-de-quadras/db/schema";

/**
 * Limite de saldo devedor por cliente na arena (padrão: R$ 200,00 = 20.000
 * centavos). Ainda não é configurável por tenant (config de PDV-11 não
 * implementada) — centralizado aqui para uso único (transferência de comanda
 * para conta e Perfil 360° do cliente, CAD-08).
 */
export const CUSTOMER_DEBIT_LIMIT_CENTS = 20000;

export const TransferToDebitInputSchema = z.object({
  comandaId: z.string().uuid(),
  customerId: z.string().uuid(),
});

export const SettleDebitInputSchema = z.object({
  customerId: z.string().uuid(),
  payments: z
    .array(
      z.object({
        paymentMethod: z.enum(["dinheiro", "pix", "cartao_credito", "cartao_debito", "pontos"]),
        amountCents: z.number().int().positive(),
      })
    )
    .min(1, "Informe ao menos um meio de pagamento."),
});

export interface CustomerDebitSummary {
  totalPendingCents: number;
  pendingDebits: CustomerDebit[];
}

export type TransferToDebitResult =
  | { success: true; customerDebit: CustomerDebit }
  | {
      success: false;
      reason:
        | "comanda_not_found"
        | "comanda_closed"
        | "customer_mismatch"
        | "comanda_empty"
        | "limit_exceeded";
      maxLimitCents?: number;
      currentDebitCents?: number;
    };

export type SettleDebitResult =
  | { success: true; settledCents: number; remainingDebitCents: number }
  | { success: false; reason: "no_pending_debit" | "invalid_amount" };

type CustomerDebitRow = {
  id: string;
  tenant_id: string;
  customer_id: string;
  comanda_id: string | null;
  amount_cents: number;
  paid_cents: number;
  status: string;
  operator_user_id: string;
  created_at: Date;
  updated_at: Date;
};

type CustomerDebitPaymentRow = {
  id: string;
  tenant_id: string;
  customer_debit_id: string;
  cash_session_id: string | null;
  payment_method: string;
  amount_cents: number;
  operator_user_id: string;
  created_at: Date;
};

const DEBIT_COLS = sql`id, tenant_id, customer_id, comanda_id, amount_cents, paid_cents, status, operator_user_id, created_at, updated_at`;
const DEBIT_PAYMENT_COLS = sql`id, tenant_id, customer_debit_id, cash_session_id, payment_method, amount_cents, operator_user_id, created_at`;

function toDebit(row: CustomerDebitRow): CustomerDebit {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerId: row.customer_id,
    comandaId: row.comanda_id,
    amountCents: row.amount_cents,
    paidCents: row.paid_cents,
    status: row.status as CustomerDebit["status"],
    operatorUserId: row.operator_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDebitPayment(row: CustomerDebitPaymentRow): CustomerDebitPayment {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerDebitId: row.customer_debit_id,
    cashSessionId: row.cash_session_id,
    paymentMethod: row.payment_method,
    amountCents: row.amount_cents,
    operatorUserId: row.operator_user_id,
    createdAt: row.created_at,
  };
}

async function writeAudit(
  ctx: TenantContext,
  action: string,
  details: Record<string, unknown>
): Promise<void> {
  if (!ctx.actorUserId) return;
  await ctx.db.execute(
    sql`INSERT INTO audit_logs (tenant_id, user_id, action, details)
        VALUES (${ctx.tenantId}, ${ctx.actorUserId}, ${action}, ${JSON.stringify(details)})`
  );
}

export async function getCustomerDebitSummary(
  ctx: TenantContext,
  customerId: string
): Promise<CustomerDebitSummary> {
  assertTenantId(ctx.tenantId);

  const result = await ctx.db.execute<CustomerDebitRow>(
    sql`SELECT ${DEBIT_COLS} FROM customer_debits
        WHERE tenant_id = ${ctx.tenantId} AND customer_id = ${customerId} AND status != 'settled'
        ORDER BY created_at ASC`
  );
  const pendingDebits = rows<CustomerDebitRow>(result).map(toDebit);
  const totalPendingCents = pendingDebits.reduce(
    (sum, d) => sum + (d.amountCents - d.paidCents),
    0
  );

  return { totalPendingCents, pendingDebits };
}

export async function transferComandaToCustomerDebit(
  ctx: TenantContext,
  input: z.infer<typeof TransferToDebitInputSchema>
): Promise<TransferToDebitResult> {
  assertTenantId(ctx.tenantId);
  if (!ctx.actorUserId) {
    throw new Error("transferComandaToCustomerDebit exige ctx.actorUserId.");
  }
  const data = TransferToDebitInputSchema.parse(input);

  const comanda = await getComandaWithItems(ctx, data.comandaId);
  if (!comanda) return { success: false, reason: "comanda_not_found" };
  if (comanda.status !== "open") return { success: false, reason: "comanda_closed" };
  if (comanda.customerId !== data.customerId) {
    return { success: false, reason: "customer_mismatch" };
  }
  if (comanda.items.length === 0 || comanda.totalCents <= 0) {
    return { success: false, reason: "comanda_empty" };
  }

  // Verifica limite de saldo devedor por tenant (padrão: R$ 200,00 = 20.000 centavos)
  const summary = await getCustomerDebitSummary(ctx, data.customerId);
  if (summary.totalPendingCents + comanda.totalCents > CUSTOMER_DEBIT_LIMIT_CENTS) {
    return {
      success: false,
      reason: "limit_exceeded",
      maxLimitCents: CUSTOMER_DEBIT_LIMIT_CENTS,
      currentDebitCents: summary.totalPendingCents,
    };
  }

  const activeSession = await getCurrentOpenCashSession(ctx);
  const cashSessionId = activeSession?.id ?? null;

  // Atualiza comanda para closed
  await ctx.db.execute(
    sql`UPDATE comandas SET status = 'closed', updated_at = now()
        WHERE id = ${data.comandaId} AND tenant_id = ${ctx.tenantId} AND status = 'open'`
  );

  // Grava comanda_payments com meio 'conta_cliente'
  await ctx.db.execute(
    sql`INSERT INTO comanda_payments
          (tenant_id, comanda_id, cash_session_id, payment_method, amount_cents, received_cents, change_cents, operator_user_id)
        VALUES (${ctx.tenantId}, ${data.comandaId}, ${cashSessionId}, 'conta_cliente', ${comanda.totalCents}, ${comanda.totalCents}, 0, ${ctx.actorUserId})`
  );

  // Insere o débito do cliente
  const debitResult = await ctx.db.execute<CustomerDebitRow>(
    sql`INSERT INTO customer_debits
          (tenant_id, customer_id, comanda_id, amount_cents, paid_cents, status, operator_user_id)
        VALUES (${ctx.tenantId}, ${data.customerId}, ${data.comandaId}, ${comanda.totalCents}, 0, 'pending', ${ctx.actorUserId})
        RETURNING ${DEBIT_COLS}`
  );
  const customerDebit = toDebit(rows<CustomerDebitRow>(debitResult)[0]);

  await writeAudit(ctx, "pdv.customer_debit.created", {
    comandaId: data.comandaId,
    customerId: data.customerId,
    amountCents: comanda.totalCents,
  });

  return { success: true, customerDebit };
}

export async function settleCustomerDebit(
  ctx: TenantContext,
  input: z.infer<typeof SettleDebitInputSchema>
): Promise<SettleDebitResult> {
  assertTenantId(ctx.tenantId);
  if (!ctx.actorUserId) {
    throw new Error("settleCustomerDebit exige ctx.actorUserId.");
  }
  const data = SettleDebitInputSchema.parse(input);

  const summary = await getCustomerDebitSummary(ctx, data.customerId);
  if (summary.pendingDebits.length === 0 || summary.totalPendingCents <= 0) {
    return { success: false, reason: "no_pending_debit" };
  }

  const activeSession = await getCurrentOpenCashSession(ctx);
  const cashSessionId = activeSession?.id ?? null;

  const totalOfferedCents = data.payments.reduce((sum, p) => sum + p.amountCents, 0);
  if (totalOfferedCents <= 0) return { success: false, reason: "invalid_amount" };

  let remainingPaymentToApply = totalOfferedCents;

  for (const debit of summary.pendingDebits) {
    if (remainingPaymentToApply <= 0) break;
    const debitOwed = debit.amountCents - debit.paidCents;
    const toPay = Math.min(debitOwed, remainingPaymentToApply);

    const newPaidCents = debit.paidCents + toPay;
    const newStatus = newPaidCents >= debit.amountCents ? "settled" : "partially_paid";

    await ctx.db.execute(
      sql`UPDATE customer_debits
          SET paid_cents = ${newPaidCents}, status = ${newStatus}, updated_at = now()
          WHERE id = ${debit.id} AND tenant_id = ${ctx.tenantId}`
    );

    remainingPaymentToApply -= toPay;

    // Registra pagamento proporcional vinculado à sessão de caixa
    for (const p of data.payments) {
      await ctx.db.execute<CustomerDebitPaymentRow>(
        sql`INSERT INTO customer_debit_payments
              (tenant_id, customer_debit_id, cash_session_id, payment_method, amount_cents, operator_user_id)
            VALUES (${ctx.tenantId}, ${debit.id}, ${cashSessionId}, ${p.paymentMethod}, ${p.amountCents}, ${ctx.actorUserId})
            RETURNING ${DEBIT_PAYMENT_COLS}`
      );
    }
  }

  const newSummary = await getCustomerDebitSummary(ctx, data.customerId);

  await writeAudit(ctx, "pdv.customer_debit.settled", {
    customerId: data.customerId,
    settledCents: totalOfferedCents,
    remainingDebitCents: newSummary.totalPendingCents,
  });

  return {
    success: true,
    settledCents: totalOfferedCents,
    remainingDebitCents: newSummary.totalPendingCents,
  };
}
