import { z } from "zod";
import { sql } from "drizzle-orm";
import { verify } from "@node-rs/argon2";
import { assertTenantId, rows, type TenantContext } from "../db/tenant";
import { getCustomerById } from "../customers/customer.service";
import { getProductById } from "../product/product.service";
import { getCurrentOpenCashSession } from "./cash-session.service";
import { getCustomerPointsSummary, redeemPoints } from "../points/points.service";

export interface Comanda {
  id: string;
  tenantId: string;
  /** null = venda balcão/anônima (PDV-03) — é o próprio discriminador, sem flag extra. */
  customerId: string | null;
  /** open | closed — fechamento é PDV-07, fora desta fase (toda comanda nasce 'open'). */
  status: "open" | "closed";
  openedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComandaItemView {
  id: string;
  tenantId: string;
  comandaId: string;
  productId: string;
  /** Snapshot imutável do nome do produto no momento do lançamento. */
  productNameAtSale: string;
  quantity: number;
  /** Snapshot imutável do preço unitário (centavos) — regra 10, CLAUDE.md. */
  unitPriceCentsAtSale: number;
  lineTotalCents: number;
  operatorUserId: string;
  createdAt: Date;
}

export interface ComandaPaymentView {
  id: string;
  tenantId: string;
  comandaId: string;
  paymentMethod: string;
  amountCents: number;
  receivedCents: number | null;
  changeCents: number;
  operatorUserId: string;
  createdAt: Date;
}

export interface ComandaWithItems extends Comanda {
  items: ComandaItemView[];
  payments: ComandaPaymentView[];
  totalCents: number;
  /** null quando balcão OU quando o cliente vinculado não existe mais (sem FK). */
  customerName: string | null;
  customerWhatsapp: string | null;
}

/** Item do painel de comandas abertas (PDV-04). */
export interface OpenComandaListItem {
  id: string;
  customerId: string | null;
  /** null = venda balcão (exibir "Venda Balcão" na UI). */
  customerName: string | null;
  customerWhatsapp: string | null;
  /** Momento de abertura — a UI calcula o tempo transcorrido. */
  openedAt: Date;
  totalCents: number;
  itemCount: number;
}

type ComandaRow = {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  status: string;
  opened_by_user_id: string;
  created_at: Date;
  updated_at: Date;
};

type ComandaItemRow = {
  id: string;
  tenant_id: string;
  comanda_id: string;
  product_id: string;
  product_name_at_sale: string;
  quantity: number;
  unit_price_cents_at_sale: number;
  operator_user_id: string;
  created_at: Date;
};

type ComandaPaymentRow = {
  id: string;
  tenant_id: string;
  comanda_id: string;
  payment_method: string;
  amount_cents: number;
  received_cents: number | null;
  change_cents: number;
  operator_user_id: string;
  created_at: Date;
};

const COMANDA_COLS = sql`id, tenant_id, customer_id, status, opened_by_user_id, created_at, updated_at`;
const ITEM_COLS = sql`id, tenant_id, comanda_id, product_id, product_name_at_sale, quantity, unit_price_cents_at_sale, operator_user_id, created_at`;

function toComanda(row: ComandaRow): Comanda {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerId: row.customer_id,
    status: row.status as Comanda["status"],
    openedByUserId: row.opened_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toItemView(row: ComandaItemRow): ComandaItemView {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    comandaId: row.comanda_id,
    productId: row.product_id,
    productNameAtSale: row.product_name_at_sale,
    quantity: row.quantity,
    unitPriceCentsAtSale: row.unit_price_cents_at_sale,
    lineTotalCents: row.quantity * row.unit_price_cents_at_sale,
    operatorUserId: row.operator_user_id,
    createdAt: row.created_at,
  };
}

function toPaymentView(row: ComandaPaymentRow): ComandaPaymentView {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    comandaId: row.comanda_id,
    paymentMethod: row.payment_method,
    amountCents: row.amount_cents,
    receivedCents: row.received_cents,
    changeCents: row.change_cents,
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

// --- Abrir comanda (PDV-02 + PDV-03) ----------------------------------------

export const OpenComandaInputSchema = z.object({
  /** Ausente/null = venda balcão (PDV-03). */
  customerId: z.string().uuid().nullable().optional(),
});

export type OpenComandaResult =
  | { success: true; comanda: Comanda }
  | { success: false; reason: "customer_not_found" }
  | { success: false; reason: "already_has_open_comanda"; existingComandaId: string };

export async function openComanda(
  ctx: TenantContext,
  input: z.infer<typeof OpenComandaInputSchema>
): Promise<OpenComandaResult> {
  assertTenantId(ctx.tenantId);
  if (!ctx.actorUserId) {
    throw new Error("openComanda exige ctx.actorUserId (operador que abre a comanda).");
  }
  const data = OpenComandaInputSchema.parse(input);
  const customerId = data.customerId ?? null;

  if (customerId) {
    // Guarda IDOR (regra 1b): nunca aceitar um id de cliente sem revalidar o tenant.
    const customer = await getCustomerById(ctx, customerId);
    if (!customer) return { success: false, reason: "customer_not_found" };

    // Regra PDV-04: Um mesmo cliente não pode ter mais de uma comanda em aberto simultaneamente.
    const existingOpenComandaResult = await ctx.db.execute<{ id: string }>(
      sql`SELECT id FROM comandas WHERE tenant_id = ${ctx.tenantId} AND customer_id = ${customerId} AND status = 'open' LIMIT 1`
    );
    const existingRow = rows<{ id: string }>(existingOpenComandaResult)[0];
    if (existingRow) {
      return { success: false, reason: "already_has_open_comanda", existingComandaId: existingRow.id };
    }
  }

  const result = await ctx.db.execute<ComandaRow>(
    sql`INSERT INTO comandas (tenant_id, customer_id, status, opened_by_user_id)
        VALUES (${ctx.tenantId}, ${customerId}, 'open', ${ctx.actorUserId})
        RETURNING ${COMANDA_COLS}`
  );
  const comanda = toComanda(rows<ComandaRow>(result)[0]);
  await writeAudit(ctx, "pdv.comanda.opened", { comandaId: comanda.id, customerId });
  return { success: true, comanda };
}

// --- Lançar item (PDV-02 AC4) ------------------------------------------------

export const AddComandaItemInputSchema = z.object({
  comandaId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.number().int().positive().max(999),
});

export type AddComandaItemResult =
  | { success: true; item: ComandaItemView; comandaTotalCents: number }
  | { success: false; reason: "comanda_not_found" | "comanda_closed" | "product_not_found" };

export async function addItemToComanda(
  ctx: TenantContext,
  input: z.infer<typeof AddComandaItemInputSchema>
): Promise<AddComandaItemResult> {
  assertTenantId(ctx.tenantId);
  if (!ctx.actorUserId) {
    throw new Error("addItemToComanda exige ctx.actorUserId (operador do lançamento).");
  }
  const data = AddComandaItemInputSchema.parse(input);

  const comandaResult = await ctx.db.execute<ComandaRow>(
    sql`SELECT ${COMANDA_COLS} FROM comandas WHERE id = ${data.comandaId} AND tenant_id = ${ctx.tenantId} LIMIT 1`
  );
  const comandaRow = rows<ComandaRow>(comandaResult)[0];
  if (!comandaRow) return { success: false, reason: "comanda_not_found" };
  if (comandaRow.status !== "open") return { success: false, reason: "comanda_closed" };

  const product = await getProductById(data.productId, ctx);
  if (!product) return { success: false, reason: "product_not_found" };

  // Snapshot imutável (regra 10, CLAUDE.md): nome/preço gravados agora, nunca
  // recalculados a partir do catálogo depois. Sem débito de estoque nesta fase
  // (CAD-02 AC3 aponta o débito para o FECHAMENTO da comanda — PDV-07).
  const insertResult = await ctx.db.execute<ComandaItemRow>(
    sql`INSERT INTO comanda_items
          (tenant_id, comanda_id, product_id, product_name_at_sale, quantity, unit_price_cents_at_sale, operator_user_id)
        VALUES (${ctx.tenantId}, ${data.comandaId}, ${data.productId}, ${product.name}, ${data.quantity},
                ${product.salePriceCents}, ${ctx.actorUserId})
        RETURNING ${ITEM_COLS}`
  );
  const item = toItemView(rows<ComandaItemRow>(insertResult)[0]);

  const totalResult = await ctx.db.execute<{ total: string | null }>(
    sql`SELECT COALESCE(SUM(quantity * unit_price_cents_at_sale), 0) AS total
        FROM comanda_items WHERE tenant_id = ${ctx.tenantId} AND comanda_id = ${data.comandaId}`
  );
  const comandaTotalCents = Number(rows<{ total: string | null }>(totalResult)[0]?.total ?? 0);

  // Ponto de extensão (WPP-02/WPP-04, fora desta fase): quando a fila de
  // notificação existir, aqui entra a checagem de opt-in do cliente (via
  // customer_opt_in_lgpd) + comanda identificada + enfileiramento em
  // notification.queue. Nenhuma implementação real ainda (regra 4, CLAUDE.md:
  // mensagens só saem pela fila, nunca síncronas no request).

  return { success: true, item, comandaTotalCents };
}

// --- Ler comanda + itens -----------------------------------------------------

export async function getComandaWithItems(
  ctx: TenantContext,
  comandaId: string
): Promise<ComandaWithItems | null> {
  assertTenantId(ctx.tenantId);
  // comandaId chega cru do segmento de rota — valida o formato antes de ir a query
  // (evita erro de sintaxe uuid não tratado no Postgres para um id mal formado).
  if (!z.string().uuid().safeParse(comandaId).success) return null;

  const comandaResult = await ctx.db.execute<
    ComandaRow & { customer_name: string | null; customer_whatsapp: string | null }
  >(
    sql`SELECT c.id, c.tenant_id, c.customer_id, c.status, c.opened_by_user_id, c.created_at, c.updated_at,
               cu.name AS customer_name, cu.whatsapp AS customer_whatsapp
        FROM comandas c
        LEFT JOIN customers cu ON cu.id = c.customer_id AND cu.tenant_id = c.tenant_id
        WHERE c.id = ${comandaId} AND c.tenant_id = ${ctx.tenantId}
        LIMIT 1`
  );
  const comandaRow = rows<ComandaRow & { customer_name: string | null; customer_whatsapp: string | null }>(
    comandaResult
  )[0];
  if (!comandaRow) return null;

  const itemsResult = await ctx.db.execute<ComandaItemRow>(
    sql`SELECT ${ITEM_COLS} FROM comanda_items
        WHERE tenant_id = ${ctx.tenantId} AND comanda_id = ${comandaId}
        ORDER BY created_at ASC`
  );
  const items = rows<ComandaItemRow>(itemsResult).map(toItemView);
  const totalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);

  const paymentsResult = await ctx.db.execute<ComandaPaymentRow>(
    sql`SELECT id, tenant_id, comanda_id, payment_method, amount_cents, received_cents, change_cents, operator_user_id, created_at
        FROM comanda_payments
        WHERE tenant_id = ${ctx.tenantId} AND comanda_id = ${comandaId}
        ORDER BY created_at ASC`
  );
  const payments = rows<ComandaPaymentRow>(paymentsResult).map(toPaymentView);

  return {
    ...toComanda(comandaRow),
    items,
    payments,
    totalCents,
    customerName: comandaRow.customer_name,
    customerWhatsapp: comandaRow.customer_whatsapp,
  };
}

// --- Painel de comandas abertas (PDV-04) ------------------------------------

type OpenComandaListRow = {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_whatsapp: string | null;
  created_at: Date;
  total_cents: string | number | null;
  item_count: string | number | null;
};

/**
 * Lista as comandas em aberto da arena (PDV-04), da mais antiga para a mais
 * recente, com o total parcial e o nome do cliente (ou null para balcão).
 * Só leitura — não exige `actorUserId`. Isolamento por tenant em todos os
 * pontos: WHERE, JOIN duplo-filtrado e subconsultas de agregação.
 */
export async function listOpenComandas(ctx: TenantContext): Promise<OpenComandaListItem[]> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<OpenComandaListRow>(
    sql`SELECT c.id, c.customer_id, c.created_at,
               cu.name AS customer_name, cu.whatsapp AS customer_whatsapp,
               COALESCE((SELECT SUM(ci.quantity * ci.unit_price_cents_at_sale)
                         FROM comanda_items ci
                         WHERE ci.tenant_id = c.tenant_id AND ci.comanda_id = c.id), 0) AS total_cents,
               COALESCE((SELECT SUM(ci2.quantity)
                         FROM comanda_items ci2
                         WHERE ci2.tenant_id = c.tenant_id AND ci2.comanda_id = c.id), 0) AS item_count
        FROM comandas c
        LEFT JOIN customers cu ON cu.id = c.customer_id AND cu.tenant_id = c.tenant_id
        WHERE c.tenant_id = ${ctx.tenantId} AND c.status = 'open'
        ORDER BY c.created_at ASC`
  );
  return rows<OpenComandaListRow>(result).map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerWhatsapp: row.customer_whatsapp,
    openedAt: row.created_at,
    totalCents: Number(row.total_cents ?? 0),
    itemCount: Number(row.item_count ?? 0),
  }));
}

// --- Converter balcão → identificada (PDV-03) -------------------------------

export const LinkCustomerToComandaInputSchema = z.object({
  comandaId: z.string().uuid(),
  customerId: z.string().uuid(),
});

export type LinkCustomerToComandaResult =
  | { success: true; comanda: Comanda }
  | {
      success: false;
      reason:
        | "comanda_not_found"
        | "comanda_closed"
        | "already_identified"
        | "customer_not_found"
        | "customer_already_has_open_comanda";
      existingComandaId?: string;
    };

export async function linkCustomerToComanda(
  ctx: TenantContext,
  input: z.infer<typeof LinkCustomerToComandaInputSchema>
): Promise<LinkCustomerToComandaResult> {
  assertTenantId(ctx.tenantId);
  if (!ctx.actorUserId) {
    throw new Error("linkCustomerToComanda exige ctx.actorUserId (operador que vincula o cliente).");
  }
  const data = LinkCustomerToComandaInputSchema.parse(input);

  const comandaResult = await ctx.db.execute<ComandaRow>(
    sql`SELECT ${COMANDA_COLS} FROM comandas WHERE id = ${data.comandaId} AND tenant_id = ${ctx.tenantId} LIMIT 1`
  );
  const comandaRow = rows<ComandaRow>(comandaResult)[0];
  if (!comandaRow) return { success: false, reason: "comanda_not_found" };
  if (comandaRow.status !== "open") return { success: false, reason: "comanda_closed" };
  if (comandaRow.customer_id) return { success: false, reason: "already_identified" };

  // Guarda IDOR (regra 1b): revalida o cliente no escopo do tenant.
  const customer = await getCustomerById(ctx, data.customerId);
  if (!customer) return { success: false, reason: "customer_not_found" };

  // Regra PDV-04: Verificar se o cliente já possui uma comanda em aberto
  const existingOpenComandaResult = await ctx.db.execute<{ id: string }>(
    sql`SELECT id FROM comandas WHERE tenant_id = ${ctx.tenantId} AND customer_id = ${data.customerId} AND status = 'open' LIMIT 1`
  );
  const existingRow = rows<{ id: string }>(existingOpenComandaResult)[0];
  if (existingRow) {
    return {
      success: false,
      reason: "customer_already_has_open_comanda",
      existingComandaId: existingRow.id,
    };
  }

  // Guarda condicional atômica: protege contra duas vinculações concorrentes.
  const updateResult = await ctx.db.execute<ComandaRow>(
    sql`UPDATE comandas SET customer_id = ${data.customerId}, updated_at = now()
        WHERE id = ${data.comandaId} AND tenant_id = ${ctx.tenantId} AND customer_id IS NULL
        RETURNING ${COMANDA_COLS}`
  );
  const updatedRow = rows<ComandaRow>(updateResult)[0];
  if (!updatedRow) return { success: false, reason: "already_identified" };

  const comanda = toComanda(updatedRow);
  await writeAudit(ctx, "pdv.comanda.customer_linked", { comandaId: comanda.id, customerId: data.customerId });
  return { success: true, comanda };
}

// --- Fechamento de comanda e pagamentos (PDV-07) ----------------------------

export const PaymentMethodEnum = z.enum([
  "dinheiro",
  "pix",
  "cartao_credito",
  "cartao_debito",
  "pontos",
]);

export const PaymentInputSchema = z.object({
  paymentMethod: PaymentMethodEnum,
  amountCents: z.number().int().positive(),
  receivedCents: z.number().int().positive().optional(),
});

export const CloseComandaInputSchema = z.object({
  comandaId: z.string().uuid(),
  discountCents: z.number().int().nonnegative().optional().default(0),
  payments: z.array(PaymentInputSchema).min(1),
});

export type CloseComandaResult =
  | { success: true; comanda: Comanda; payments: ComandaPaymentView[]; totalChangeCents: number }
  | {
      success: false;
      reason:
        | "comanda_not_found"
        | "comanda_closed"
        | "comanda_empty"
        | "insufficient_payment"
        | "invalid_cash_received"
        | "points_disabled"
        | "points_anonymous_comanda"
        | "points_insufficient_balance"
        | "points_exceed_max_redemption";
    };

export async function closeComanda(
  ctx: TenantContext,
  input: z.infer<typeof CloseComandaInputSchema>
): Promise<CloseComandaResult> {
  assertTenantId(ctx.tenantId);
  if (!ctx.actorUserId) {
    throw new Error("closeComanda exige ctx.actorUserId (operador que fecha a comanda).");
  }
  const data = CloseComandaInputSchema.parse(input);

  const comandaResult = await ctx.db.execute<ComandaRow>(
    sql`SELECT ${COMANDA_COLS} FROM comandas WHERE id = ${data.comandaId} AND tenant_id = ${ctx.tenantId} LIMIT 1`
  );
  const comandaRow = rows<ComandaRow>(comandaResult)[0];
  if (!comandaRow) return { success: false, reason: "comanda_not_found" };
  if (comandaRow.status !== "open") return { success: false, reason: "comanda_closed" };

  const totalResult = await ctx.db.execute<{ total: string | null }>(
    sql`SELECT COALESCE(SUM(quantity * unit_price_cents_at_sale), 0) AS total
        FROM comanda_items WHERE tenant_id = ${ctx.tenantId} AND comanda_id = ${data.comandaId}`
  );
  const totalItemsCents = Number(rows<{ total: string | null }>(totalResult)[0]?.total ?? 0);
  if (totalItemsCents <= 0) return { success: false, reason: "comanda_empty" };

  const finalTotalCents = Math.max(0, totalItemsCents - data.discountCents);
  const totalPaidCents = data.payments.reduce((sum, p) => sum + p.amountCents, 0);

  if (totalPaidCents < finalTotalCents) {
    return { success: false, reason: "insufficient_payment" };
  }

  // PDV-08: Validação do resgate de pontos como meio de pagamento
  const pointsPayments = data.payments.filter((p) => p.paymentMethod === "pontos");
  if (pointsPayments.length > 0) {
    if (!comandaRow.customer_id) {
      return { success: false, reason: "points_anonymous_comanda" };
    }

    const pointsSummary = await getCustomerPointsSummary(ctx, comandaRow.customer_id, finalTotalCents);
    if (!pointsSummary.enabled) {
      return { success: false, reason: "points_disabled" };
    }

    const totalPointsCents = pointsPayments.reduce((sum, p) => sum + p.amountCents, 0);

    if (totalPointsCents > pointsSummary.maxAllowedRedemptionCents) {
      if (totalPointsCents > pointsSummary.balanceValueCents) {
        return { success: false, reason: "points_insufficient_balance" };
      } else {
        return { success: false, reason: "points_exceed_max_redemption" };
      }
    }

    // Calcula a quantidade de pontos que precisam ser resgatados
    const pointsToRedeem = Math.ceil((totalPointsCents * pointsSummary.redemptionPointsPerReal) / 100);
    const redeemRes = await redeemPoints(ctx, comandaRow.customer_id, pointsToRedeem, data.comandaId);
    if (!redeemRes.success) {
      return { success: false, reason: "points_insufficient_balance" };
    }
  }

  // Validação de pagamentos em dinheiro e cálculo de troco
  let totalChangeCents = 0;
  const processedPayments: Array<{
    method: string;
    amountCents: number;
    receivedCents: number | null;
    changeCents: number;
  }> = [];

  for (const p of data.payments) {
    let change = 0;
    let received: number | null = p.receivedCents ?? null;
    if (p.paymentMethod === "dinheiro") {
      const rec = p.receivedCents ?? p.amountCents;
      if (rec < p.amountCents) {
        return { success: false, reason: "invalid_cash_received" };
      }
      change = rec - p.amountCents;
      received = rec;
      totalChangeCents += change;
    }
    processedPayments.push({
      method: p.paymentMethod,
      amountCents: p.amountCents,
      receivedCents: received,
      changeCents: change,
    });
  }

  // Atualiza comanda atomicamente para 'closed'
  const updateResult = await ctx.db.execute<ComandaRow>(
    sql`UPDATE comandas SET status = 'closed', updated_at = now()
        WHERE id = ${data.comandaId} AND tenant_id = ${ctx.tenantId} AND status = 'open'
        RETURNING ${COMANDA_COLS}`
  );
  const updatedRow = rows<ComandaRow>(updateResult)[0];
  if (!updatedRow) return { success: false, reason: "comanda_closed" };

  // Grava pagamentos
  const activeSession = await getCurrentOpenCashSession(ctx);
  const cashSessionId = activeSession?.id ?? null;

  const paymentViews: ComandaPaymentView[] = [];
  for (const p of processedPayments) {
    const payResult = await ctx.db.execute<ComandaPaymentRow>(
      sql`INSERT INTO comanda_payments
            (tenant_id, comanda_id, cash_session_id, payment_method, amount_cents, received_cents, change_cents, operator_user_id)
          VALUES (${ctx.tenantId}, ${data.comandaId}, ${cashSessionId}, ${p.method}, ${p.amountCents}, ${p.receivedCents}, ${p.changeCents}, ${ctx.actorUserId})
          RETURNING id, tenant_id, comanda_id, payment_method, amount_cents, received_cents, change_cents, operator_user_id, created_at`
    );
    paymentViews.push(toPaymentView(rows<ComandaPaymentRow>(payResult)[0]));
  }

  const comanda = toComanda(updatedRow);
  await writeAudit(ctx, "pdv.comanda.closed", {
    comandaId: comanda.id,
    totalCents: totalItemsCents,
    discountCents: data.discountCents,
    finalTotalCents,
    totalPaidCents,
    totalChangeCents,
  });

  return { success: true, comanda, payments: paymentViews, totalChangeCents };
}

// --- Cancelamento de item de comanda (PDV-09) -------------------------------

export const CancelComandaItemInputSchema = z.object({
  comandaId: z.string().uuid(),
  comandaItemId: z.string().uuid(),
  reason: z.string().trim().min(5, "A justificativa deve ter no mínimo 5 caracteres."),
  supervisorPassword: z.string().optional(),
});

export type CancelComandaItemResult =
  | { success: true; comandaItemId: string }
  | {
      success: false;
      reason:
        | "comanda_not_found"
        | "comanda_closed"
        | "item_not_found"
        | "unauthorized"
        | "invalid_supervisor_password";
    };

export async function cancelComandaItem(
  ctx: TenantContext,
  input: z.infer<typeof CancelComandaItemInputSchema>
): Promise<CancelComandaItemResult> {
  assertTenantId(ctx.tenantId);
  if (!ctx.actorUserId) {
    throw new Error("cancelComandaItem exige ctx.actorUserId.");
  }
  const data = CancelComandaItemInputSchema.parse(input);

  // 1. Verifica se a comanda existe e está aberta
  const comandaResult = await ctx.db.execute<ComandaRow>(
    sql`SELECT ${COMANDA_COLS} FROM comandas WHERE id = ${data.comandaId} AND tenant_id = ${ctx.tenantId} LIMIT 1`
  );
  const comandaRow = rows<ComandaRow>(comandaResult)[0];
  if (!comandaRow) return { success: false, reason: "comanda_not_found" };
  if (comandaRow.status !== "open") return { success: false, reason: "comanda_closed" };

  // 2. Busca o item a ser cancelado
  const itemResult = await ctx.db.execute<ComandaItemRow>(
    sql`SELECT ${ITEM_COLS} FROM comanda_items
        WHERE id = ${data.comandaItemId} AND comanda_id = ${data.comandaId} AND tenant_id = ${ctx.tenantId}
        LIMIT 1`
  );
  const itemRow = rows<ComandaItemRow>(itemResult)[0];
  if (!itemRow) return { success: false, reason: "item_not_found" };

  // 3. Verifica permissões de supervisor
  const actorResult = await ctx.db.execute<{ role: string }>(
    sql`SELECT role FROM users_tenants WHERE id = ${ctx.actorUserId} AND tenant_id = ${ctx.tenantId} LIMIT 1`
  );
  const actorRole = rows<{ role: string }>(actorResult)[0]?.role;

  let supervisorUserId = ctx.actorUserId;

  if (actorRole === "admin" || actorRole === "gerente") {
    // Autorizado diretamente pelo próprio perfil do operador
  } else {
    // Atendente ou outro perfil: exige senha de supervisor (admin/gerente)
    if (!data.supervisorPassword) {
      return { success: false, reason: "unauthorized" };
    }

    const supervisorsResult = await ctx.db.execute<{ id: string; password_hash: string | null }>(
      sql`SELECT id, password_hash FROM users_tenants
          WHERE tenant_id = ${ctx.tenantId}
            AND role IN ('admin', 'gerente')
            AND status = 'active'`
    );
    const supervisors = rows<{ id: string; password_hash: string | null }>(supervisorsResult);

    let validSupervisorId: string | null = null;
    for (const sup of supervisors) {
      if (sup.password_hash) {
        const matches = await verify(sup.password_hash, data.supervisorPassword);
        if (matches) {
          validSupervisorId = sup.id;
          break;
        }
      }
    }

    if (!validSupervisorId) {
      return { success: false, reason: "invalid_supervisor_password" };
    }

    supervisorUserId = validSupervisorId;
  }

  // 4. Deleta o item da comanda
  await ctx.db.execute(
    sql`DELETE FROM comanda_items
        WHERE id = ${data.comandaItemId} AND comanda_id = ${data.comandaId} AND tenant_id = ${ctx.tenantId}`
  );

  // 5. Registra log de auditoria
  await writeAudit(ctx, "pdv.item.cancelled", {
    comandaId: data.comandaId,
    comandaItemId: data.comandaItemId,
    productId: itemRow.product_id,
    quantity: itemRow.quantity,
    unitPriceCents: itemRow.unit_price_cents_at_sale,
    reason: data.reason,
    cancelledByUserId: ctx.actorUserId,
    supervisorUserId,
  });

  return { success: true, comandaItemId: data.comandaItemId };
}

