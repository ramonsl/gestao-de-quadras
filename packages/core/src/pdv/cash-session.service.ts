import { z } from "zod";
import { sql } from "drizzle-orm";
import { assertTenantId, rows, type TenantContext } from "../db/tenant";
import type { CashSession, CashMovement, CashClosingCount } from "@gestao-de-quadras/db/schema";

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

export const OpenCashSessionInputSchema = z.object({
  initialCashCents: z.number().int().nonnegative(),
});

export const AddCashMovementInputSchema = z.object({
  cashSessionId: z.string().uuid(),
  type: z.enum(["sangria", "suprimento"]),
  amountCents: z.number().int().positive(),
  reason: z.string().trim().min(3, "Informe um motivo com pelo menos 3 caracteres."),
});

export const ClosingCountInputSchema = z.object({
  paymentMethod: z.enum(["dinheiro", "pix", "cartao_credito", "cartao_debito", "pontos"]),
  countedCents: z.number().int().nonnegative(),
});

export const CloseCashSessionInputSchema = z.object({
  cashSessionId: z.string().uuid(),
  counts: z.array(ClosingCountInputSchema).min(1),
  closingNotes: z.string().optional(),
});

export interface CashSessionSummary {
  cashSession: CashSession;
  movements: CashMovement[];
  expectedByMethod: Record<string, number>;
  totalExpectedCents: number;
}

export type OpenCashSessionResult =
  | { success: true; cashSession: CashSession }
  | { success: false; reason: "already_open"; existingSession: CashSession };

export type AddCashMovementResult =
  | { success: true; movement: CashMovement }
  | { success: false; reason: "session_not_found" | "session_closed" };

export type CloseCashSessionResult =
  | {
      success: true;
      cashSession: CashSession;
      counts: CashClosingCount[];
      totalDifferenceCents: number;
    }
  | { success: false; reason: "session_not_found" | "session_closed" };

type CashSessionRow = {
  id: string;
  tenant_id: string;
  operator_user_id: string;
  closed_by_user_id: string | null;
  status: string;
  initial_cash_cents: number;
  opened_at: Date;
  closed_at: Date | null;
  closing_notes: string | null;
};

type CashMovementRow = {
  id: string;
  tenant_id: string;
  cash_session_id: string;
  type: string;
  amount_cents: number;
  reason: string;
  operator_user_id: string;
  created_at: Date;
};

type CashClosingCountRow = {
  id: string;
  tenant_id: string;
  cash_session_id: string;
  payment_method: string;
  expected_cents: number;
  counted_cents: number;
  difference_cents: number;
};

const SESSION_COLS = sql`id, tenant_id, operator_user_id, closed_by_user_id, status, initial_cash_cents, opened_at, closed_at, closing_notes`;
const MOVEMENT_COLS = sql`id, tenant_id, cash_session_id, type, amount_cents, reason, operator_user_id, created_at`;
const COUNT_COLS = sql`id, tenant_id, cash_session_id, payment_method, expected_cents, counted_cents, difference_cents`;

function toCashSession(row: CashSessionRow): CashSession {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    operatorUserId: row.operator_user_id,
    closedByUserId: row.closed_by_user_id,
    status: row.status as CashSession["status"],
    initialCashCents: row.initial_cash_cents,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    closingNotes: row.closing_notes,
  };
}

function toCashMovement(row: CashMovementRow): CashMovement {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    cashSessionId: row.cash_session_id,
    type: row.type as CashMovement["type"],
    amountCents: row.amount_cents,
    reason: row.reason,
    operatorUserId: row.operator_user_id,
    createdAt: row.created_at,
  };
}

function toCashClosingCount(row: CashClosingCountRow): CashClosingCount {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    cashSessionId: row.cash_session_id,
    paymentMethod: row.payment_method,
    expectedCents: row.expected_cents,
    countedCents: row.counted_cents,
    differenceCents: row.difference_cents,
  };
}

export async function getCurrentOpenCashSession(
  ctx: TenantContext
): Promise<CashSession | null> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<CashSessionRow>(
    sql`SELECT ${SESSION_COLS} FROM cash_sessions
        WHERE tenant_id = ${ctx.tenantId} AND status = 'open'
        ORDER BY opened_at DESC LIMIT 1`
  );
  const row = rows<CashSessionRow>(result)[0];
  return row ? toCashSession(row) : null;
}

export async function openCashSession(
  ctx: TenantContext,
  input: z.infer<typeof OpenCashSessionInputSchema>
): Promise<OpenCashSessionResult> {
  assertTenantId(ctx.tenantId);
  if (!ctx.actorUserId) {
    throw new Error("openCashSession exige ctx.actorUserId (operador que abre o caixa).");
  }
  const data = OpenCashSessionInputSchema.parse(input);

  const active = await getCurrentOpenCashSession(ctx);
  if (active) {
    return { success: false, reason: "already_open", existingSession: active };
  }

  const result = await ctx.db.execute<CashSessionRow>(
    sql`INSERT INTO cash_sessions (tenant_id, operator_user_id, status, initial_cash_cents)
        VALUES (${ctx.tenantId}, ${ctx.actorUserId}, 'open', ${data.initialCashCents})
        RETURNING ${SESSION_COLS}`
  );
  const session = toCashSession(rows<CashSessionRow>(result)[0]);

  await writeAudit(ctx, "pdv.cash_session.opened", {
    cashSessionId: session.id,
    initialCashCents: data.initialCashCents,
  });

  return { success: true, cashSession: session };
}

export async function addCashMovement(
  ctx: TenantContext,
  input: z.infer<typeof AddCashMovementInputSchema>
): Promise<AddCashMovementResult> {
  assertTenantId(ctx.tenantId);
  if (!ctx.actorUserId) {
    throw new Error("addCashMovement exige ctx.actorUserId (operador que lança a movimentação).");
  }
  const data = AddCashMovementInputSchema.parse(input);

  const sessionResult = await ctx.db.execute<CashSessionRow>(
    sql`SELECT ${SESSION_COLS} FROM cash_sessions
        WHERE id = ${data.cashSessionId} AND tenant_id = ${ctx.tenantId} LIMIT 1`
  );
  const sessionRow = rows<CashSessionRow>(sessionResult)[0];
  if (!sessionRow) return { success: false, reason: "session_not_found" };
  if (sessionRow.status !== "open") return { success: false, reason: "session_closed" };

  const movementResult = await ctx.db.execute<CashMovementRow>(
    sql`INSERT INTO cash_movements (tenant_id, cash_session_id, type, amount_cents, reason, operator_user_id)
        VALUES (${ctx.tenantId}, ${data.cashSessionId}, ${data.type}, ${data.amountCents}, ${data.reason}, ${ctx.actorUserId})
        RETURNING ${MOVEMENT_COLS}`
  );
  const movement = toCashMovement(rows<CashMovementRow>(movementResult)[0]);

  await writeAudit(ctx, "pdv.cash_movement.created", {
    cashSessionId: data.cashSessionId,
    movementId: movement.id,
    type: data.type,
    amountCents: data.amountCents,
  });

  return { success: true, movement };
}

export async function getCashSessionSummary(
  ctx: TenantContext,
  cashSessionId: string
): Promise<CashSessionSummary | null> {
  assertTenantId(ctx.tenantId);

  const sessionResult = await ctx.db.execute<CashSessionRow>(
    sql`SELECT ${SESSION_COLS} FROM cash_sessions
        WHERE id = ${cashSessionId} AND tenant_id = ${ctx.tenantId} LIMIT 1`
  );
  const sessionRow = rows<CashSessionRow>(sessionResult)[0];
  if (!sessionRow) return null;
  const cashSession = toCashSession(sessionRow);

  const movementsResult = await ctx.db.execute<CashMovementRow>(
    sql`SELECT ${MOVEMENT_COLS} FROM cash_movements
        WHERE tenant_id = ${ctx.tenantId} AND cash_session_id = ${cashSessionId}
        ORDER BY created_at ASC`
  );
  const movements = rows<CashMovementRow>(movementsResult).map(toCashMovement);

  const endTime = cashSession.closedAt ?? new Date();

  // Consulta pagamentos efetuados vinculados à sessão ou no período
  const paymentsResult = await ctx.db.execute<{
    payment_method: string;
    total_amount: string;
    total_change: string;
  }>(
    sql`SELECT payment_method,
               COALESCE(SUM(amount_cents), 0) AS total_amount,
               COALESCE(SUM(change_cents), 0) AS total_change
        FROM comanda_payments
        WHERE tenant_id = ${ctx.tenantId}
          AND (
            cash_session_id = ${cashSessionId}
            OR (created_at >= ${cashSession.openedAt} AND created_at <= ${endTime})
          )
        GROUP BY payment_method`
  );
  const paymentRows = rows<{ payment_method: string; total_amount: string; total_change: string }>(paymentsResult);

  const expectedByMethod: Record<string, number> = {
    dinheiro: cashSession.initialCashCents,
    pix: 0,
    cartao_credito: 0,
    cartao_debito: 0,
    pontos: 0,
  };

  // Aplica suprimentos e sangrias no saldo esperado em dinheiro
  for (const m of movements) {
    if (m.type === "suprimento") expectedByMethod.dinheiro += m.amountCents;
    if (m.type === "sangria") expectedByMethod.dinheiro -= m.amountCents;
  }

  // Somatório das vendas por meio de pagamento
  for (const pr of paymentRows) {
    const amt = Number(pr.total_amount ?? 0);
    const change = Number(pr.total_change ?? 0);
    const netAmt = amt - change; // Se dinheiro, o troco já saiu da gaveta

    if (pr.payment_method === "dinheiro") {
      expectedByMethod.dinheiro += netAmt;
    } else if (expectedByMethod[pr.payment_method] !== undefined) {
      expectedByMethod[pr.payment_method] += netAmt;
    } else {
      expectedByMethod[pr.payment_method] = netAmt;
    }
  }

  // Consulta pagamentos de quitação de débitos efetuados na sessão
  const debitPaymentsResult = await ctx.db.execute<{
    payment_method: string;
    total_amount: string;
  }>(
    sql`SELECT payment_method,
               COALESCE(SUM(amount_cents), 0) AS total_amount
        FROM customer_debit_payments
        WHERE tenant_id = ${ctx.tenantId}
          AND (
            cash_session_id = ${cashSessionId}
            OR (created_at >= ${cashSession.openedAt} AND created_at <= ${endTime})
          )
        GROUP BY payment_method`
  );
  const debitPaymentRows = rows<{ payment_method: string; total_amount: string }>(debitPaymentsResult);

  for (const dpr of debitPaymentRows) {
    const amt = Number(dpr.total_amount ?? 0);
    if (dpr.payment_method === "dinheiro") {
      expectedByMethod.dinheiro += amt;
    } else if (expectedByMethod[dpr.payment_method] !== undefined) {
      expectedByMethod[dpr.payment_method] += amt;
    } else {
      expectedByMethod[dpr.payment_method] = amt;
    }
  }

  const totalExpectedCents = Object.values(expectedByMethod).reduce((sum, val) => sum + val, 0);

  return {
    cashSession,
    movements,
    expectedByMethod,
    totalExpectedCents,
  };
}

export async function closeCashSession(
  ctx: TenantContext,
  input: z.infer<typeof CloseCashSessionInputSchema>
): Promise<CloseCashSessionResult> {
  assertTenantId(ctx.tenantId);
  if (!ctx.actorUserId) {
    throw new Error("closeCashSession exige ctx.actorUserId (operador que fecha o caixa).");
  }
  const data = CloseCashSessionInputSchema.parse(input);

  const summary = await getCashSessionSummary(ctx, data.cashSessionId);
  if (!summary) return { success: false, reason: "session_not_found" };
  if (summary.cashSession.status !== "open") {
    return { success: false, reason: "session_closed" };
  }

  let totalDiff = 0;
  const countRows: CashClosingCountRow[] = [];

  for (const c of data.counts) {
    const expected = summary.expectedByMethod[c.paymentMethod] ?? 0;
    const diff = c.countedCents - expected;
    totalDiff += diff;

    const countResult = await ctx.db.execute<CashClosingCountRow>(
      sql`INSERT INTO cash_closing_counts (tenant_id, cash_session_id, payment_method, expected_cents, counted_cents, difference_cents)
          VALUES (${ctx.tenantId}, ${data.cashSessionId}, ${c.paymentMethod}, ${expected}, ${c.countedCents}, ${diff})
          RETURNING ${COUNT_COLS}`
    );
    countRows.push(rows<CashClosingCountRow>(countResult)[0]);
  }

  const updateResult = await ctx.db.execute<CashSessionRow>(
    sql`UPDATE cash_sessions
        SET status = 'closed',
            closed_by_user_id = ${ctx.actorUserId},
            closed_at = now(),
            closing_notes = ${data.closingNotes ?? null}
        WHERE id = ${data.cashSessionId} AND tenant_id = ${ctx.tenantId} AND status = 'open'
        RETURNING ${SESSION_COLS}`
  );
  const updatedSession = toCashSession(rows<CashSessionRow>(updateResult)[0]);

  await writeAudit(ctx, "pdv.cash_session.closed", {
    cashSessionId: updatedSession.id,
    totalExpectedCents: summary.totalExpectedCents,
    totalDifferenceCents: totalDiff,
  });

  return {
    success: true,
    cashSession: updatedSession,
    counts: countRows.map(toCashClosingCount),
    totalDifferenceCents: totalDiff,
  };
}
