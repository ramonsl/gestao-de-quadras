import { z } from "zod";
import { sql } from "drizzle-orm";
import { verify } from "@node-rs/argon2";
import { assertTenantId, rows, type TenantContext } from "../db/tenant";
import { getCustomerById } from "../customers/customer.service";
import { getProductById } from "../product/product.service";
import { getCurrentOpenCashSession } from "./cash-session.service";
import { getCustomerPointsSummary, redeemPoints } from "../points/points.service";
import {
  enqueueComandaNotificationIfEligible,
  type NotificationQueuePort,
} from "../whatsapp/notification.service";

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
  grossTotalCents: number | null;
  membershipDiscountCents: number | null;
  netTotalCents: number | null;
  appliedMembershipPlanId: string | null;
  appliedMembershipPlanName: string | null;
}

export interface ComandaItemView {
  id: string;
  tenantId: string;
  comandaId: string;
  /** 'product' | 'court_rental' | 'class_package' */
  itemType: string;
  /** null para class_package e court_rental */
  productId: string | null;
  /** null para product e court_rental */
  classPackageId: string | null;
  /** Snapshot imutável do nome do produto/pacote no momento do lançamento. */
  productNameAtSale: string;
  quantity: number;
  /** Snapshot imutável do preço unitário (centavos) — regra 10, CLAUDE.md. */
  unitPriceCentsAtSale: number;
  lineTotalCents: number;
  categoryAtSale: string | null;
  membershipDiscountPercent: number;
  membershipDiscountCents: number;
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
  /** global_customer_id do cliente vinculado — null para balcão (PDV-06). */
  globalCustomerId: string | null;
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
  gross_total_cents?: number | null;
  membership_discount_cents?: number | null;
  net_total_cents?: number | null;
  applied_membership_plan_id?: string | null;
  applied_membership_plan_name?: string | null;
};

type ComandaItemRow = {
  id: string;
  tenant_id: string;
  comanda_id: string;
  item_type: string;
  product_id: string | null;
  class_package_id: string | null;
  product_name_at_sale: string;
  quantity: number;
  unit_price_cents_at_sale: number;
  operator_user_id: string;
  created_at: Date;
  category_at_sale?: string | null;
  membership_discount_percent?: number;
  membership_discount_cents?: number;
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

const COMANDA_COLS = sql`id, tenant_id, customer_id, status, opened_by_user_id, created_at, updated_at,
  gross_total_cents, membership_discount_cents, net_total_cents,
  applied_membership_plan_id, applied_membership_plan_name`;
const ITEM_COLS = sql`id, tenant_id, comanda_id, item_type, product_id, class_package_id,
  product_name_at_sale, category_at_sale, quantity, unit_price_cents_at_sale,
  membership_discount_percent, membership_discount_cents, operator_user_id, created_at`;

function toComanda(row: ComandaRow): Comanda {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerId: row.customer_id,
    status: row.status as Comanda["status"],
    openedByUserId: row.opened_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    grossTotalCents: row.gross_total_cents ?? null,
    membershipDiscountCents: row.membership_discount_cents ?? null,
    netTotalCents: row.net_total_cents ?? null,
    appliedMembershipPlanId: row.applied_membership_plan_id ?? null,
    appliedMembershipPlanName: row.applied_membership_plan_name ?? null,
  };
}

function toItemView(row: ComandaItemRow): ComandaItemView {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    comandaId: row.comanda_id,
    itemType: row.item_type ?? "product",
    productId: row.product_id,
    classPackageId: row.class_package_id,
    productNameAtSale: row.product_name_at_sale,
    quantity: row.quantity,
    unitPriceCentsAtSale: row.unit_price_cents_at_sale,
    lineTotalCents: row.quantity * row.unit_price_cents_at_sale,
    categoryAtSale: row.category_at_sale ?? null,
    membershipDiscountPercent: row.membership_discount_percent ?? 0,
    membershipDiscountCents: row.membership_discount_cents ?? 0,
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
  input: z.infer<typeof AddComandaItemInputSchema>,
  notificationQueue?: NotificationQueuePort
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
          (tenant_id, comanda_id, item_type, product_id, product_name_at_sale, category_at_sale, quantity, unit_price_cents_at_sale, operator_user_id)
        VALUES (${ctx.tenantId}, ${data.comandaId}, 'product', ${data.productId}, ${product.name}, ${product.category}, ${data.quantity},
                ${product.salePriceCents}, ${ctx.actorUserId})
        RETURNING ${ITEM_COLS}`
  );
  const item = toItemView(rows<ComandaItemRow>(insertResult)[0]);

  const totalResult = await ctx.db.execute<{ total: string | null }>(
    sql`SELECT COALESCE(SUM(quantity * unit_price_cents_at_sale), 0) AS total
        FROM comanda_items WHERE tenant_id = ${ctx.tenantId} AND comanda_id = ${data.comandaId}`
  );
  const comandaTotalCents = Number(rows<{ total: string | null }>(totalResult)[0]?.total ?? 0);

  if (notificationQueue && comandaRow.customer_id) {
    void enqueueComandaNotificationIfEligible(
      ctx,
      { comandaId: data.comandaId, customerId: comandaRow.customer_id },
      notificationQueue
    ).catch(() => undefined);
  }

  return { success: true, item, comandaTotalCents };
}

// --- Lançar pacote de aulas (PDV-06) -----------------------------------------

export const AddClassPackageItemInputSchema = z.object({
  comandaId: z.string().uuid(),
  classPackageId: z.string().uuid(),
  quantity: z.number().int().positive().max(99),
});

export type AddClassPackageItemResult =
  | { success: true; item: ComandaItemView; comandaTotalCents: number }
  | {
      success: false;
      reason:
        | "comanda_not_found"
        | "comanda_closed"
        | "comanda_requires_customer"
        | "class_package_not_found"
        | "class_package_inactive";
    };

export async function addClassPackageItemToComanda(
  ctx: TenantContext,
  input: z.infer<typeof AddClassPackageItemInputSchema>
): Promise<AddClassPackageItemResult> {
  assertTenantId(ctx.tenantId);
  if (!ctx.actorUserId) {
    throw new Error("addClassPackageItemToComanda exige ctx.actorUserId.");
  }
  const data = AddClassPackageItemInputSchema.parse(input);

  const comandaResult = await ctx.db.execute<ComandaRow>(
    sql`SELECT ${COMANDA_COLS} FROM comandas WHERE id = ${data.comandaId} AND tenant_id = ${ctx.tenantId} LIMIT 1`
  );
  const comandaRow = rows<ComandaRow>(comandaResult)[0];
  if (!comandaRow) return { success: false, reason: "comanda_not_found" };
  if (comandaRow.status !== "open") return { success: false, reason: "comanda_closed" };
  if (!comandaRow.customer_id) return { success: false, reason: "comanda_requires_customer" };

  // IDOR guard: valida classPackageId dentro do tenant
  const pkgResult = await ctx.db.execute<{
    id: string;
    name: string;
    total_class_count: number;
    price_in_cents: number;
    is_active: boolean;
  }>(
    sql`SELECT id, name, total_class_count, price_in_cents, is_active
        FROM class_packages
        WHERE id = ${data.classPackageId} AND tenant_id = ${ctx.tenantId}
        LIMIT 1`
  );
  const pkg = rows<{ id: string; name: string; total_class_count: number; price_in_cents: number; is_active: boolean }>(
    pkgResult
  )[0];
  if (!pkg) return { success: false, reason: "class_package_not_found" };
  if (!pkg.is_active) return { success: false, reason: "class_package_inactive" };

  const insertResult = await ctx.db.execute<ComandaItemRow>(
    sql`INSERT INTO comanda_items
          (tenant_id, comanda_id, item_type, class_package_id, class_count_at_sale, product_name_at_sale, quantity, unit_price_cents_at_sale, operator_user_id)
        VALUES (${ctx.tenantId}, ${data.comandaId}, 'class_package', ${data.classPackageId},
                ${pkg.total_class_count}, ${pkg.name}, ${data.quantity}, ${pkg.price_in_cents}, ${ctx.actorUserId})
        RETURNING ${ITEM_COLS}`
  );
  const item = toItemView(rows<ComandaItemRow>(insertResult)[0]);

  const totalResult = await ctx.db.execute<{ total: string | null }>(
    sql`SELECT COALESCE(SUM(quantity * unit_price_cents_at_sale), 0) AS total
        FROM comanda_items WHERE tenant_id = ${ctx.tenantId} AND comanda_id = ${data.comandaId}`
  );
  const comandaTotalCents = Number(rows<{ total: string | null }>(totalResult)[0]?.total ?? 0);

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
    ComandaRow & { customer_name: string | null; customer_whatsapp: string | null; global_customer_id: string | null }
  >(
    sql`SELECT c.id, c.tenant_id, c.customer_id, c.status, c.opened_by_user_id, c.created_at, c.updated_at,
               c.gross_total_cents, c.membership_discount_cents, c.net_total_cents,
               c.applied_membership_plan_id, c.applied_membership_plan_name,
               cu.name AS customer_name, cu.whatsapp AS customer_whatsapp,
               cu.global_customer_id AS global_customer_id
        FROM comandas c
        LEFT JOIN customers cu ON cu.id = c.customer_id AND cu.tenant_id = c.tenant_id
        WHERE c.id = ${comandaId} AND c.tenant_id = ${ctx.tenantId}
        LIMIT 1`
  );
  const comandaRow = rows<ComandaRow & { customer_name: string | null; customer_whatsapp: string | null; global_customer_id: string | null }>(
    comandaResult
  )[0];
  if (!comandaRow) return null;

  const itemsResult = await ctx.db.execute<ComandaItemRow>(
    sql`SELECT ${ITEM_COLS} FROM comanda_items
        WHERE tenant_id = ${ctx.tenantId} AND comanda_id = ${comandaId}
        ORDER BY created_at ASC`
  );
  const items = rows<ComandaItemRow>(itemsResult).map(toItemView);
  const grossItemsCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const totalCents = comandaRow.status === "closed" && comandaRow.net_total_cents != null
    ? Number(comandaRow.net_total_cents)
    : grossItemsCents;

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
    globalCustomerId: comandaRow.global_customer_id,
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
  /** Interno: identifica a versão do settlement transacional (FIL-01). */
  settlementId: z.string().uuid().optional(),
  discountCents: z.number().int().nonnegative().optional().default(0),
  payments: z.array(PaymentInputSchema),
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
    const redeemRes = await redeemPoints(
      ctx,
      comandaRow.customer_id,
      pointsToRedeem,
      data.settlementId ?? data.comandaId
    );
    if (!redeemRes.success) {
      return { success: false, reason: "points_insufficient_balance" };
    }
  }

  // Cálculo de troco por meio de pagamento. Cada forma cobre parte da comanda
  // (nunca mais que o restante); o excesso entregue vira troco — vale para
  // qualquer meio, não só dinheiro. 'pontos' é abatimento e nunca gera troco.
  // Grava-se `amount_cents` = valor entregue no meio; assim o líquido por meio
  // (`amount_cents − change_cents` = parcela que cobriu a conta) mantém a
  // conferência de caixa correta (ver cash-session.service: netAmt = amt − change).
  let totalChangeCents = 0;
  let remainingCents = finalTotalCents;
  const processedPayments: Array<{
    method: string;
    amountCents: number;
    receivedCents: number | null;
    changeCents: number;
  }> = [];

  for (const p of data.payments) {
    const chargeCents = Math.min(p.amountCents, Math.max(0, remainingCents));
    remainingCents -= chargeCents;

    if (p.paymentMethod === "pontos") {
      // Pontos abatem valor: sem troco e sem "recebido".
      processedPayments.push({
        method: p.paymentMethod,
        amountCents: p.amountCents,
        receivedCents: null,
        changeCents: 0,
      });
      continue;
    }

    // Valor entregue pelo cliente neste meio (dinheiro: recebido; demais: o cobrado).
    const tenderedCents = p.paymentMethod === "dinheiro" ? (p.receivedCents ?? p.amountCents) : p.amountCents;
    if (tenderedCents < chargeCents) {
      return { success: false, reason: "invalid_cash_received" };
    }
    const changeCents = tenderedCents - chargeCents;
    totalChangeCents += changeCents;

    processedPayments.push({
      method: p.paymentMethod,
      amountCents: tenderedCents,
      receivedCents: changeCents > 0 || p.paymentMethod === "dinheiro" ? tenderedCents : null,
      changeCents,
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
            (tenant_id, comanda_id, settlement_id, cash_session_id, payment_method, amount_cents, received_cents, change_cents, operator_user_id)
          VALUES (${ctx.tenantId}, ${data.comandaId}, ${data.settlementId ?? null}, ${cashSessionId}, ${p.method}, ${p.amountCents}, ${p.receivedCents}, ${p.changeCents}, ${ctx.actorUserId})
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

  // PDV-06: creditar saldo de aulas. No fluxo FIL-01 esta operação participa
  // da mesma transação do pagamento e qualquer falha reverte o fechamento.
  await creditClassPackageBalances(ctx, data.comandaId, comandaRow.customer_id, data.settlementId ?? null);

  return { success: true, comanda, payments: paymentViews, totalChangeCents };
}

// --- Crédito de saldo de aulas ao fechar comanda (PDV-06) -------------------

async function creditClassPackageBalances(
  ctx: TenantContext,
  comandaId: string,
  customerId: string | null,
  settlementId: string | null
): Promise<void> {
  if (!customerId) return;

  // Busca global_customer_id do cliente local (tenant-scoped)
  const customerResult = await ctx.db.execute<{ global_customer_id: string }>(
    sql`SELECT global_customer_id FROM customers
        WHERE id = ${customerId} AND tenant_id = ${ctx.tenantId} LIMIT 1`
  );
  const globalCustomerId = rows<{ global_customer_id: string }>(customerResult)[0]?.global_customer_id;
  if (!globalCustomerId) return;

  // Busca itens de pacote de aula desta comanda (usa snapshot class_count_at_sale — regra 10)
  const itemsResult = await ctx.db.execute<{
    item_id: string;
    class_package_id: string;
    quantity: number;
    class_count_at_sale: number;
  }>(
    sql`SELECT ci.id AS item_id, ci.class_package_id, ci.quantity, ci.class_count_at_sale
        FROM comanda_items ci
        WHERE ci.comanda_id = ${comandaId} AND ci.tenant_id = ${ctx.tenantId}
          AND ci.item_type = 'class_package' AND ci.class_package_id IS NOT NULL
          AND ci.class_count_at_sale IS NOT NULL`
  );
  const pkgItems = rows<{ item_id: string; class_package_id: string; quantity: number; class_count_at_sale: number }>(itemsResult);
  if (pkgItems.length === 0) return;

  for (const item of pkgItems) {
    const remainingClasses = item.class_count_at_sale * item.quantity;
    // ON CONFLICT garante idempotência: re-close (reopen + close) não gera crédito duplo
    await ctx.db.execute(
      sql`INSERT INTO student_class_balance
            (tenant_id, global_customer_id, class_package_id, comanda_item_id, settlement_id, remaining_classes, purchased_at)
          VALUES (${ctx.tenantId}, ${globalCustomerId}, ${item.class_package_id}, ${item.item_id}, ${settlementId}, ${remainingClasses}, now())
          ON CONFLICT (tenant_id, comanda_item_id) DO NOTHING`
    );
  }
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

// --- Reabertura / Estorno de comanda fechada (PDV-09) -----------------------

export const ReopenComandaInputSchema = z.object({
  comandaId: z.string().uuid(),
  reason: z.string().trim().min(5, "A justificativa deve ter no mínimo 5 caracteres."),
  supervisorPassword: z.string().optional(),
});

export type ReopenComandaResult =
  | { success: true; comandaId: string }
  | {
      success: false;
      reason:
        | "comanda_not_found"
        | "comanda_not_closed"
        | "unauthorized"
        | "invalid_supervisor_password";
    };

export async function reopenComanda(
  ctx: TenantContext,
  input: z.infer<typeof ReopenComandaInputSchema>
): Promise<ReopenComandaResult> {
  assertTenantId(ctx.tenantId);
  if (!ctx.actorUserId) {
    throw new Error("reopenComanda exige ctx.actorUserId.");
  }
  const data = ReopenComandaInputSchema.parse(input);

  const comandaResult = await ctx.db.execute<ComandaRow>(
    sql`SELECT ${COMANDA_COLS} FROM comandas WHERE id = ${data.comandaId} AND tenant_id = ${ctx.tenantId} LIMIT 1`
  );
  const comandaRow = rows<ComandaRow>(comandaResult)[0];
  if (!comandaRow) return { success: false, reason: "comanda_not_found" };
  if (comandaRow.status !== "closed") return { success: false, reason: "comanda_not_closed" };

  const actorResult = await ctx.db.execute<{ role: string }>(
    sql`SELECT role FROM users_tenants WHERE id = ${ctx.actorUserId} AND tenant_id = ${ctx.tenantId} LIMIT 1`
  );
  const actorRole = rows<{ role: string }>(actorResult)[0]?.role;

  let supervisorUserId = ctx.actorUserId;

  if (actorRole === "admin" || actorRole === "gerente") {
    // Autorizado diretamente pelo supervisor
  } else {
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

  // Altera status de volta para open
  await ctx.db.execute(
    sql`UPDATE comandas SET status = 'open', updated_at = now()
        WHERE id = ${data.comandaId} AND tenant_id = ${ctx.tenantId}`
  );

  await writeAudit(ctx, "pdv.comanda.reopened", {
    comandaId: data.comandaId,
    reason: data.reason,
    reopenedByUserId: ctx.actorUserId,
    supervisorUserId,
  });

  return { success: true, comandaId: data.comandaId };
}

// --- Transferência de itens entre comandas (PDV-10) -------------------------

export const TransferItemsInputSchema = z.object({
  sourceComandaId: z.string().uuid(),
  destinationComandaId: z.string().uuid(),
  itemIds: z.array(z.string().uuid()).min(1),
  /** Justificativa opcional para a transferência (auditoria). */
  justificativa: z.string().trim().optional(),
});

export type TransferItemsResult =
  | {
      success: true;
      transferredItemIds: string[];
      sourceTotalCents: number;
      destinationTotalCents: number;
    }
  | {
      success: false;
      reason:
        | "same_comanda"
        | "source_comanda_not_found"
        | "source_comanda_closed"
        | "destination_comanda_not_found"
        | "destination_comanda_closed"
        | "item_not_found"
        | "destination_requires_customer";
      /** ID do item que não foi encontrado na comanda de origem. */
      missingItemId?: string;
    };

export async function transferItemsBetweenComandas(
  ctx: TenantContext,
  input: z.infer<typeof TransferItemsInputSchema>,
  notificationQueue?: NotificationQueuePort
): Promise<TransferItemsResult> {
  assertTenantId(ctx.tenantId);
  if (!ctx.actorUserId) {
    throw new Error("transferItemsBetweenComandas exige ctx.actorUserId.");
  }
  const data = TransferItemsInputSchema.parse(input);

  // AC9: Rejeita transferência para a mesma comanda.
  if (data.sourceComandaId === data.destinationComandaId) {
    return { success: false, reason: "same_comanda" };
  }

  // 1. Valida comanda de ORIGEM (tenant-scoped).
  const srcResult = await ctx.db.execute<ComandaRow>(
    sql`SELECT ${COMANDA_COLS} FROM comandas WHERE id = ${data.sourceComandaId} AND tenant_id = ${ctx.tenantId} LIMIT 1`
  );
  const srcRow = rows<ComandaRow>(srcResult)[0];
  if (!srcRow) return { success: false, reason: "source_comanda_not_found" };
  if (srcRow.status !== "open") return { success: false, reason: "source_comanda_closed" };

  // 2. Valida comanda de DESTINO (tenant-scoped).
  const dstResult = await ctx.db.execute<ComandaRow>(
    sql`SELECT ${COMANDA_COLS} FROM comandas WHERE id = ${data.destinationComandaId} AND tenant_id = ${ctx.tenantId} LIMIT 1`
  );
  const dstRow = rows<ComandaRow>(dstResult)[0];
  if (!dstRow) return { success: false, reason: "destination_comanda_not_found" };
  if (dstRow.status !== "open") return { success: false, reason: "destination_comanda_closed" };

  // 3. Busca os itens selecionados — todos devem pertencer à comanda de origem.
  const itemsResult = await ctx.db.execute<ComandaItemRow>(
    sql`SELECT ${ITEM_COLS} FROM comanda_items
        WHERE tenant_id = ${ctx.tenantId} AND comanda_id = ${data.sourceComandaId}
        ORDER BY created_at ASC`
  );
  const allSourceItems = rows<ComandaItemRow>(itemsResult);
  const sourceItemMap = new Map(allSourceItems.map((i) => [i.id, i]));

  for (const itemId of data.itemIds) {
    if (!sourceItemMap.has(itemId)) {
      return { success: false, reason: "item_not_found", missingItemId: itemId };
    }
  }

  const selectedItems = data.itemIds.map((id) => sourceItemMap.get(id)!);

  // AC4: Itens class_package exigem que a comanda de destino tenha cliente vinculado.
  const hasClassPackage = selectedItems.some((i) => i.item_type === "class_package");
  if (hasClassPackage && !dstRow.customer_id) {
    return { success: false, reason: "destination_requires_customer" };
  }

  // 4. Move os itens: UPDATE comanda_id para a comanda de destino.
  //    Metadados originais (operator_user_id, created_at, preço, nome) são preservados (AC3).
  for (const itemId of data.itemIds) {
    await ctx.db.execute(
      sql`UPDATE comanda_items SET comanda_id = ${data.destinationComandaId}
          WHERE id = ${itemId} AND tenant_id = ${ctx.tenantId} AND comanda_id = ${data.sourceComandaId}`
    );
  }

  // 5. Recalcula totais de ambas as comandas (AC5).
  const srcTotalResult = await ctx.db.execute<{ total: string | null }>(
    sql`SELECT COALESCE(SUM(quantity * unit_price_cents_at_sale), 0) AS total
        FROM comanda_items WHERE tenant_id = ${ctx.tenantId} AND comanda_id = ${data.sourceComandaId}`
  );
  const sourceTotalCents = Number(rows<{ total: string | null }>(srcTotalResult)[0]?.total ?? 0);

  const dstTotalResult = await ctx.db.execute<{ total: string | null }>(
    sql`SELECT COALESCE(SUM(quantity * unit_price_cents_at_sale), 0) AS total
        FROM comanda_items WHERE tenant_id = ${ctx.tenantId} AND comanda_id = ${data.destinationComandaId}`
  );
  const destinationTotalCents = Number(rows<{ total: string | null }>(dstTotalResult)[0]?.total ?? 0);

  // 6. Audit log (AC8).
  await writeAudit(ctx, "pdv.items.transferred", {
    sourceComandaId: data.sourceComandaId,
    destinationComandaId: data.destinationComandaId,
    itemIds: data.itemIds,
    actorUserId: ctx.actorUserId,
    justificativa: data.justificativa ?? null,
  });

  // 7. Notificações de correção via WhatsApp (AC6 + AC7).
  if (notificationQueue) {
    const transferredViews = selectedItems.map(toItemView);
    const formatCurrency = (cents: number): string =>
      `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

    // AC6: Notificação ao cliente da comanda de ORIGEM (itens removidos).
    if (srcRow.customer_id) {
      void enqueueTransferCorrectionNotification(
        ctx,
        {
          customerId: srcRow.customer_id,
          comandaId: data.sourceComandaId,
          items: transferredViews,
          newTotalCents: sourceTotalCents,
          direction: "removed",
        },
        notificationQueue,
        formatCurrency
      ).catch(() => undefined);
    }

    // AC7: Notificação ao cliente da comanda de DESTINO (itens adicionados).
    if (dstRow.customer_id) {
      void enqueueTransferCorrectionNotification(
        ctx,
        {
          customerId: dstRow.customer_id,
          comandaId: data.destinationComandaId,
          items: transferredViews,
          newTotalCents: destinationTotalCents,
          direction: "added",
        },
        notificationQueue,
        formatCurrency
      ).catch(() => undefined);
    }
  }

  return {
    success: true,
    transferredItemIds: data.itemIds,
    sourceTotalCents,
    destinationTotalCents,
  };
}

/**
 * Enfileira notificação de correção por transferência de itens (PDV-10 AC6/AC7).
 * Fire-and-forget — nunca lança erro para o chamador.
 */
async function enqueueTransferCorrectionNotification(
  ctx: TenantContext,
  input: {
    customerId: string;
    comandaId: string;
    items: ComandaItemView[];
    newTotalCents: number;
    direction: "removed" | "added";
  },
  queue: NotificationQueuePort,
  formatCurrency: (cents: number) => string
): Promise<void> {
  // Verifica opt-in LGPD do cliente.
  const optInResult = await ctx.db.execute<{ opt_in: boolean }>(
    sql`SELECT opt_in FROM customer_opt_in_lgpd
        WHERE customer_id = ${input.customerId} AND tenant_id = ${ctx.tenantId}
        LIMIT 1`
  );
  const optIn = rows<{ opt_in: boolean }>(optInResult)[0];
  if (!optIn?.opt_in) return;

  // Busca WhatsApp do cliente.
  const customerResult = await ctx.db.execute<{ whatsapp: string | null }>(
    sql`SELECT whatsapp FROM customers
        WHERE id = ${input.customerId} AND tenant_id = ${ctx.tenantId}
        LIMIT 1`
  );
  const customer = rows<{ whatsapp: string | null }>(customerResult)[0];
  if (!customer?.whatsapp) return;

  const itemLines = input.items.map(
    (it) => `• ${it.productNameAtSale} x${it.quantity} — ${formatCurrency(it.unitPriceCentsAtSale)}`
  );

  const header =
    input.direction === "removed"
      ? "🔄 *Correção na sua comanda — itens transferidos:*"
      : "🔄 *Correção na sua comanda — itens recebidos:*";

  const bodyText = [
    header,
    "",
    ...itemLines,
    "",
    `*Novo total da comanda: ${formatCurrency(input.newTotalCents)}*`,
  ].join("\n");

  await queue.enqueueTextMessage({
    tenantId: ctx.tenantId,
    customerId: input.customerId,
    comandaId: input.comandaId,
    toE164: customer.whatsapp,
    bodyText,
  });
}
