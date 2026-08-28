import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { assertTenantId, rows, type TenantContext } from "../db/tenant";
import {
  PaymentInputSchema,
  ReopenComandaInputSchema,
  closeComanda,
  reopenComanda,
  type CloseComandaResult,
  type ReopenComandaResult,
} from "../pdv/comanda.service";

export const BillingPeriodSchema = z.enum(["monthly", "semiannual", "annual"]);

const DiscountPercentSchema = z.number().int().min(0).max(100);

export const SaveMembershipPlanInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(1).max(1000),
  cyclePriceCents: z.number().int().positive(),
  billingPeriod: BillingPeriodSchema,
  productDiscountPercent: DiscountPercentSchema,
  courtRentalDiscountPercent: DiscountPercentSchema,
  classPackageDiscountPercent: DiscountPercentSchema,
  productCategories: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
});

export const CreateCustomerMembershipInputSchema = z
  .object({
    customerId: z.string().uuid(),
    membershipPlanId: z.string().uuid(),
    startsOn: z.string().date(),
    endsOn: z.string().date().nullable().optional(),
  })
  .refine((value) => !value.endsOn || value.endsOn >= value.startsOn, {
    message: "A data final deve ser igual ou posterior à data inicial.",
    path: ["endsOn"],
  });

export interface MembershipPlanView {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  cyclePriceCents: number;
  billingPeriod: z.infer<typeof BillingPeriodSchema>;
  productDiscountPercent: number;
  courtRentalDiscountPercent: number;
  classPackageDiscountPercent: number;
  productCategories: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerMembershipView {
  id: string;
  customerId: string;
  customerName: string;
  membershipPlanId: string;
  membershipPlanName: string;
  startsOn: string;
  endsOn: string | null;
  status: "active" | "ended";
  eligibleToday: boolean;
}

export interface SettlementPreviewLine {
  itemId: string;
  itemType: string;
  description: string;
  grossCents: number;
  discountPercent: number;
  discountCents: number;
  netCents: number;
}

export interface SettlementPreview {
  comandaId: string;
  membershipPlanId: string | null;
  membershipPlanName: string | null;
  grossTotalCents: number;
  discountTotalCents: number;
  netTotalCents: number;
  lines: SettlementPreviewLine[];
  settlementToken: string;
}

export const CloseComandaWithMembershipInputSchema = z.object({
  comandaId: z.string().uuid(),
  settlementToken: z.string().length(64),
  payments: z.array(PaymentInputSchema),
});

export type CloseComandaWithMembershipResult =
  | (Extract<CloseComandaResult, { success: true }> & { settlement: SettlementPreview })
  | Exclude<CloseComandaResult, { success: true }>
  | { success: false; reason: "settlement_changed"; preview: SettlementPreview };

type PlanRow = {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  cycle_price_cents: number;
  billing_period: z.infer<typeof BillingPeriodSchema>;
  product_discount_percent: number;
  court_rental_discount_percent: number;
  class_package_discount_percent: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

const PLAN_COLUMNS = sql`id, tenant_id, name, description, cycle_price_cents, billing_period,
  product_discount_percent, court_rental_discount_percent, class_package_discount_percent,
  is_active, created_at, updated_at`;

async function audit(ctx: TenantContext, action: string, details: Record<string, unknown>): Promise<void> {
  if (!ctx.actorUserId) throw new Error(`${action} exige operador autenticado.`);
  await ctx.db.execute(
    sql`INSERT INTO audit_logs (tenant_id, user_id, action, details)
        VALUES (${ctx.tenantId}, ${ctx.actorUserId}, ${action}, ${JSON.stringify(details)})`
  );
}

async function categoriesByPlan(ctx: TenantContext, planIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (planIds.length === 0) return map;
  const result = await ctx.db.execute<{ membership_plan_id: string; category: string }>(
    sql`SELECT membership_plan_id, category
        FROM membership_plan_product_categories
        WHERE tenant_id = ${ctx.tenantId} AND membership_plan_id = ANY(${planIds})`
  );
  for (const row of rows<{ membership_plan_id: string; category: string }>(result)) {
    map.set(row.membership_plan_id, [...(map.get(row.membership_plan_id) ?? []), row.category]);
  }
  return map;
}

function toPlan(row: PlanRow, categories: string[]): MembershipPlanView {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description,
    cyclePriceCents: row.cycle_price_cents,
    billingPeriod: row.billing_period,
    productDiscountPercent: row.product_discount_percent,
    courtRentalDiscountPercent: row.court_rental_discount_percent,
    classPackageDiscountPercent: row.class_package_discount_percent,
    productCategories: categories,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listMembershipPlans(ctx: TenantContext): Promise<MembershipPlanView[]> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<PlanRow>(
    sql`SELECT ${PLAN_COLUMNS} FROM membership_plans
        WHERE tenant_id = ${ctx.tenantId} ORDER BY is_active DESC, name ASC`
  );
  const planRows = rows<PlanRow>(result);
  const categories = await categoriesByPlan(ctx, planRows.map((plan) => plan.id));
  return planRows.map((plan) => toPlan(plan, categories.get(plan.id) ?? []));
}

export async function saveMembershipPlan(
  ctx: TenantContext,
  input: z.infer<typeof SaveMembershipPlanInputSchema>
): Promise<MembershipPlanView> {
  assertTenantId(ctx.tenantId);
  if (!ctx.actorUserId) throw new Error("saveMembershipPlan exige operador autenticado.");
  const data = SaveMembershipPlanInputSchema.parse(input);
  let row: PlanRow | undefined;

  if (data.id) {
    const result = await ctx.db.execute<PlanRow>(
      sql`UPDATE membership_plans SET
            name = ${data.name}, description = ${data.description},
            cycle_price_cents = ${data.cyclePriceCents}, billing_period = ${data.billingPeriod},
            product_discount_percent = ${data.productDiscountPercent},
            court_rental_discount_percent = ${data.courtRentalDiscountPercent},
            class_package_discount_percent = ${data.classPackageDiscountPercent}, updated_at = now()
          WHERE id = ${data.id} AND tenant_id = ${ctx.tenantId}
          RETURNING ${PLAN_COLUMNS}`
    );
    row = rows<PlanRow>(result)[0];
    if (!row) throw new Error("Plano não encontrado.");
    await ctx.db.execute(
      sql`DELETE FROM membership_plan_product_categories
          WHERE tenant_id = ${ctx.tenantId} AND membership_plan_id = ${data.id}`
    );
  } else {
    const result = await ctx.db.execute<PlanRow>(
      sql`INSERT INTO membership_plans
            (tenant_id, name, description, cycle_price_cents, billing_period,
             product_discount_percent, court_rental_discount_percent, class_package_discount_percent)
          VALUES (${ctx.tenantId}, ${data.name}, ${data.description}, ${data.cyclePriceCents},
                  ${data.billingPeriod}, ${data.productDiscountPercent},
                  ${data.courtRentalDiscountPercent}, ${data.classPackageDiscountPercent})
          RETURNING ${PLAN_COLUMNS}`
    );
    row = rows<PlanRow>(result)[0];
  }

  const uniqueCategories = [...new Set(data.productCategories.map((category) => category.trim()))];
  for (const category of uniqueCategories) {
    await ctx.db.execute(
      sql`INSERT INTO membership_plan_product_categories (tenant_id, membership_plan_id, category)
          VALUES (${ctx.tenantId}, ${row.id}, ${category})`
    );
  }
  await audit(ctx, data.id ? "membership.plan.updated" : "membership.plan.created", { planId: row.id });
  return toPlan(row, uniqueCategories);
}

export async function deactivateMembershipPlan(ctx: TenantContext, planId: string): Promise<boolean> {
  assertTenantId(ctx.tenantId);
  const id = z.string().uuid().parse(planId);
  const result = await ctx.db.execute<{ id: string }>(
    sql`UPDATE membership_plans SET is_active = false, updated_at = now()
        WHERE id = ${id} AND tenant_id = ${ctx.tenantId} AND is_active = true RETURNING id`
  );
  const changed = Boolean(rows<{ id: string }>(result)[0]);
  if (changed) await audit(ctx, "membership.plan.deactivated", { planId: id });
  return changed;
}

export async function listCustomerMemberships(ctx: TenantContext): Promise<CustomerMembershipView[]> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<{
    id: string; customer_id: string; customer_name: string; membership_plan_id: string;
    plan_name: string; starts_on: string; ends_on: string | null; status: "active" | "ended";
    eligible_today: boolean;
  }>(sql`SELECT cm.id, cm.customer_id, c.name AS customer_name,
                cm.membership_plan_id, mp.name AS plan_name, cm.starts_on, cm.ends_on, cm.status,
                (cm.status = 'active' AND mp.is_active = true
                 AND cm.starts_on <= (now() AT TIME ZONE 'UTC')::date
                 AND (cm.ends_on IS NULL OR cm.ends_on >= (now() AT TIME ZONE 'UTC')::date)) AS eligible_today
         FROM customer_memberships cm
         JOIN customers c ON c.id = cm.customer_id AND c.tenant_id = cm.tenant_id
         JOIN membership_plans mp ON mp.id = cm.membership_plan_id AND mp.tenant_id = cm.tenant_id
         WHERE cm.tenant_id = ${ctx.tenantId}
         ORDER BY cm.created_at DESC`);
  return rows<{
    id: string; customer_id: string; customer_name: string; membership_plan_id: string;
    plan_name: string; starts_on: string; ends_on: string | null; status: "active" | "ended";
    eligible_today: boolean;
  }>(result).map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    membershipPlanId: row.membership_plan_id,
    membershipPlanName: row.plan_name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    status: row.status,
    eligibleToday: row.eligible_today,
  }));
}

export type CreateCustomerMembershipResult =
  | { success: true; membershipId: string }
  | { success: false; reason: "customer_not_found" | "plan_not_found_or_inactive" | "already_active" };

export async function createCustomerMembership(
  ctx: TenantContext,
  input: z.infer<typeof CreateCustomerMembershipInputSchema>
): Promise<CreateCustomerMembershipResult> {
  assertTenantId(ctx.tenantId);
  if (!ctx.actorUserId) throw new Error("createCustomerMembership exige operador autenticado.");
  const data = CreateCustomerMembershipInputSchema.parse(input);
  const customer = rows<{ id: string }>(await ctx.db.execute<{ id: string }>(
    sql`SELECT id FROM customers WHERE id = ${data.customerId} AND tenant_id = ${ctx.tenantId} LIMIT 1`
  ))[0];
  if (!customer) return { success: false, reason: "customer_not_found" };
  const plan = rows<{ id: string }>(await ctx.db.execute<{ id: string }>(
    sql`SELECT id FROM membership_plans
        WHERE id = ${data.membershipPlanId} AND tenant_id = ${ctx.tenantId} AND is_active = true LIMIT 1`
  ))[0];
  if (!plan) return { success: false, reason: "plan_not_found_or_inactive" };
  try {
    const result = await ctx.db.execute<{ id: string }>(
      sql`INSERT INTO customer_memberships
            (tenant_id, customer_id, membership_plan_id, starts_on, ends_on, created_by_user_id)
          VALUES (${ctx.tenantId}, ${data.customerId}, ${data.membershipPlanId}, ${data.startsOn},
                  ${data.endsOn ?? null}, ${ctx.actorUserId}) RETURNING id`
    );
    const membershipId = rows<{ id: string }>(result)[0].id;
    await audit(ctx, "membership.customer.linked", { membershipId, customerId: data.customerId, planId: data.membershipPlanId });
    return { success: true, membershipId };
  } catch (error) {
    if (error instanceof Error && (error.message.includes("customer_memberships_one_active_idx") || error.message.includes("duplicate key"))) {
      return { success: false, reason: "already_active" };
    }
    throw error;
  }
}

export async function endCustomerMembership(ctx: TenantContext, membershipId: string): Promise<boolean> {
  assertTenantId(ctx.tenantId);
  if (!ctx.actorUserId) throw new Error("endCustomerMembership exige operador autenticado.");
  const id = z.string().uuid().parse(membershipId);
  const result = await ctx.db.execute<{ id: string }>(
    sql`UPDATE customer_memberships
        SET status = 'ended', ended_at = now(), ended_by_user_id = ${ctx.actorUserId}, updated_at = now()
        WHERE id = ${id} AND tenant_id = ${ctx.tenantId} AND status = 'active' RETURNING id`
  );
  const changed = Boolean(rows<{ id: string }>(result)[0]);
  if (changed) await audit(ctx, "membership.customer.ended", { membershipId: id });
  return changed;
}

type PreviewItemRow = {
  id: string;
  item_type: string;
  product_name_at_sale: string;
  category_at_sale: string | null;
  quantity: number;
  unit_price_cents_at_sale: number;
};

type EligiblePlanRow = PlanRow & { categories: string[] | null };

export function calculateLineDiscount(grossCents: number, percent: number): number {
  return Math.floor((grossCents * percent + 50) / 100);
}

export async function getSettlementPreview(ctx: TenantContext, comandaId: string): Promise<SettlementPreview | null> {
  assertTenantId(ctx.tenantId);
  const id = z.string().uuid().parse(comandaId);
  const comanda = rows<{ id: string; customer_id: string | null; status: string }>(
    await ctx.db.execute<{ id: string; customer_id: string | null; status: string }>(
      sql`SELECT id, customer_id, status FROM comandas
          WHERE id = ${id} AND tenant_id = ${ctx.tenantId} LIMIT 1`
    )
  )[0];
  if (!comanda || comanda.status !== "open") return null;

  const items = rows<PreviewItemRow>(await ctx.db.execute<PreviewItemRow>(
    sql`SELECT id, item_type, product_name_at_sale, category_at_sale, quantity, unit_price_cents_at_sale
        FROM comanda_items WHERE comanda_id = ${id} AND tenant_id = ${ctx.tenantId} ORDER BY id`
  ));

  let plan: EligiblePlanRow | undefined;
  if (comanda.customer_id) {
    plan = rows<EligiblePlanRow>(await ctx.db.execute<EligiblePlanRow>(
      sql`SELECT mp.id, mp.tenant_id, mp.name, mp.description, mp.cycle_price_cents,
                 mp.billing_period, mp.product_discount_percent, mp.court_rental_discount_percent,
                 mp.class_package_discount_percent, mp.is_active, mp.created_at, mp.updated_at,
                 COALESCE(array_agg(pc.category) FILTER (WHERE pc.category IS NOT NULL), ARRAY[]::varchar[]) AS categories
          FROM customer_memberships cm
          JOIN membership_plans mp ON mp.id = cm.membership_plan_id AND mp.tenant_id = cm.tenant_id
          LEFT JOIN membership_plan_product_categories pc
            ON pc.membership_plan_id = mp.id AND pc.tenant_id = mp.tenant_id
          WHERE cm.tenant_id = ${ctx.tenantId} AND cm.customer_id = ${comanda.customer_id}
            AND cm.status = 'active' AND mp.is_active = true
            AND cm.starts_on <= (now() AT TIME ZONE 'UTC')::date
            AND (cm.ends_on IS NULL OR cm.ends_on >= (now() AT TIME ZONE 'UTC')::date)
          GROUP BY mp.id LIMIT 1`
    ))[0];
  }

  const eligibleCategories = new Set(plan?.categories ?? []);
  const lines = items.map((item): SettlementPreviewLine => {
    const grossCents = item.quantity * item.unit_price_cents_at_sale;
    const applicableDiscounts = [0];
    if (plan) {
      if (item.item_type === "product" && item.category_at_sale && eligibleCategories.has(item.category_at_sale)) {
        applicableDiscounts.push(plan.product_discount_percent);
      }
      if (item.item_type === "court_rental") {
        applicableDiscounts.push(plan.court_rental_discount_percent);
      }
      if (item.item_type === "class_package") {
        applicableDiscounts.push(plan.class_package_discount_percent);
      }
    }
    // Regras nunca acumulam: se novos benefícios passarem a atingir a mesma
    // linha, somente o maior percentual será aplicado.
    const discountPercent = Math.max(...applicableDiscounts);
    const discountCents = calculateLineDiscount(grossCents, discountPercent);
    return {
      itemId: item.id,
      itemType: item.item_type,
      description: item.product_name_at_sale,
      grossCents,
      discountPercent,
      discountCents,
      netCents: grossCents - discountCents,
    };
  });
  const grossTotalCents = lines.reduce((sum, line) => sum + line.grossCents, 0);
  const discountTotalCents = lines.reduce((sum, line) => sum + line.discountCents, 0);
  const tokenPayload = JSON.stringify({
    tenantId: ctx.tenantId,
    comandaId: id,
    customerId: comanda.customer_id,
    planId: plan?.id ?? null,
    planUpdatedAt: plan?.updated_at?.toISOString() ?? null,
    lines: lines.map(({ itemId, itemType, grossCents, discountPercent, discountCents }) => ({
      itemId, itemType, grossCents, discountPercent, discountCents,
    })),
  });
  return {
    comandaId: id,
    membershipPlanId: plan?.id ?? null,
    membershipPlanName: plan?.name ?? null,
    grossTotalCents,
    discountTotalCents,
    netTotalCents: grossTotalCents - discountTotalCents,
    lines,
    settlementToken: createHash("sha256").update(tokenPayload).digest("hex"),
  };
}

/**
 * Fecha usando exclusivamente o desconto recalculado no servidor. O caller de
 * produção deve executar esta função dentro de uma transação PostgreSQL.
 */
export async function closeComandaWithMembership(
  ctx: TenantContext,
  input: z.infer<typeof CloseComandaWithMembershipInputSchema>
): Promise<CloseComandaWithMembershipResult> {
  assertTenantId(ctx.tenantId);
  if (!ctx.actorUserId) throw new Error("closeComandaWithMembership exige operador autenticado.");
  const data = CloseComandaWithMembershipInputSchema.parse(input);
  await ctx.db.execute(
    sql`SELECT id FROM comandas
        WHERE id = ${data.comandaId} AND tenant_id = ${ctx.tenantId} FOR UPDATE`
  );
  const preview = await getSettlementPreview(ctx, data.comandaId);
  if (!preview) return { success: false, reason: "comanda_not_found" };
  if (preview.settlementToken !== data.settlementToken) {
    return { success: false, reason: "settlement_changed", preview };
  }
  if (preview.netTotalCents > 0 && data.payments.length === 0) {
    return { success: false, reason: "insufficient_payment" };
  }

  const versionResult = await ctx.db.execute<{ next_version: string | number }>(
    sql`SELECT COALESCE(MAX(version), 0) + 1 AS next_version
        FROM comanda_settlements WHERE tenant_id = ${ctx.tenantId} AND comanda_id = ${data.comandaId}`
  );
  const version = Number(rows<{ next_version: string | number }>(versionResult)[0]?.next_version ?? 1);
  const settlementResult = await ctx.db.execute<{ id: string }>(
    sql`INSERT INTO comanda_settlements
          (tenant_id, comanda_id, version, status, settlement_token, membership_plan_id, membership_plan_name,
           gross_total_cents, discount_total_cents, net_total_cents, closed_by_user_id)
        VALUES (${ctx.tenantId}, ${data.comandaId}, ${version}, 'pending', ${preview.settlementToken},
                ${preview.membershipPlanId}, ${preview.membershipPlanName}, ${preview.grossTotalCents},
                ${preview.discountTotalCents}, ${preview.netTotalCents}, ${ctx.actorUserId})
        RETURNING id`
  );
  const settlementId = rows<{ id: string }>(settlementResult)[0].id;

  const closed = await closeComanda(ctx, {
    comandaId: data.comandaId,
    settlementId,
    discountCents: preview.discountTotalCents,
    payments: data.payments,
  });
  if (!closed.success) {
    await ctx.db.execute(
      sql`DELETE FROM comanda_settlements
          WHERE id = ${settlementId} AND tenant_id = ${ctx.tenantId} AND status = 'pending'`
    );
    return closed;
  }

  for (const line of preview.lines) {
    await ctx.db.execute(
      sql`UPDATE comanda_items
          SET membership_discount_percent = ${line.discountPercent},
              membership_discount_cents = ${line.discountCents}
          WHERE id = ${line.itemId} AND comanda_id = ${data.comandaId}
            AND tenant_id = ${ctx.tenantId}`
    );
  }
  await ctx.db.execute(
    sql`UPDATE comandas SET gross_total_cents = ${preview.grossTotalCents},
            membership_discount_cents = ${preview.discountTotalCents}, net_total_cents = ${preview.netTotalCents},
            applied_membership_plan_id = ${preview.membershipPlanId},
            applied_membership_plan_name = ${preview.membershipPlanName}
        WHERE id = ${data.comandaId} AND tenant_id = ${ctx.tenantId}`
  );
  await ctx.db.execute(
    sql`UPDATE comanda_settlements SET status = 'active'
        WHERE id = ${settlementId} AND tenant_id = ${ctx.tenantId} AND status = 'pending'`
  );
  await audit(ctx, "membership.settlement.closed", {
    comandaId: data.comandaId,
    version,
    planId: preview.membershipPlanId,
    grossTotalCents: preview.grossTotalCents,
    discountTotalCents: preview.discountTotalCents,
    netTotalCents: preview.netTotalCents,
  });
  return { ...closed, settlement: preview };
}

export async function reopenComandaWithSettlement(
  ctx: TenantContext,
  input: z.infer<typeof ReopenComandaInputSchema>
): Promise<ReopenComandaResult | { success: false; reason: "settlement_reversal_blocked" }> {
  const settlement = rows<{ id: string }>(await ctx.db.execute<{ id: string }>(
    sql`SELECT id FROM comanda_settlements
        WHERE tenant_id = ${ctx.tenantId} AND comanda_id = ${input.comandaId} AND status = 'active'
        LIMIT 1`
  ))[0];
  if (!settlement) return { success: false, reason: "settlement_reversal_blocked" };

  const closedCashSession = rows<{ id: string }>(await ctx.db.execute<{ id: string }>(
    sql`SELECT cp.id FROM comanda_payments cp
        JOIN cash_sessions cs ON cs.id = cp.cash_session_id AND cs.tenant_id = cp.tenant_id
        WHERE cp.tenant_id = ${ctx.tenantId} AND cp.settlement_id = ${settlement.id}
          AND cs.status = 'closed' LIMIT 1`
  ))[0];
  if (closedCashSession) return { success: false, reason: "settlement_reversal_blocked" };

  const consumedClassCredit = rows<{ id: string }>(await ctx.db.execute<{ id: string }>(
    sql`SELECT scb.id FROM student_class_balance scb
        JOIN comanda_items ci ON ci.id = scb.comanda_item_id AND ci.tenant_id = scb.tenant_id
        WHERE scb.tenant_id = ${ctx.tenantId} AND scb.settlement_id = ${settlement.id}
          AND scb.remaining_classes < (ci.class_count_at_sale * ci.quantity) LIMIT 1`
  ))[0];
  if (consumedClassCredit) return { success: false, reason: "settlement_reversal_blocked" };

  const reopened = await reopenComanda(ctx, input);
  if (!reopened.success) return reopened;
  const pointRedemptions = rows<{ customer_id: string; points: string | number }>(
    await ctx.db.execute<{ customer_id: string; points: string | number }>(
      sql`SELECT customer_id, -SUM(amount_points) AS points
          FROM customer_points_transactions
          WHERE tenant_id = ${ctx.tenantId} AND reference_id = ${settlement.id}
            AND transaction_type = 'redeem'
          GROUP BY customer_id`
    )
  );
  for (const redemption of pointRedemptions) {
    const points = Number(redemption.points);
    await ctx.db.execute(
      sql`UPDATE customer_points_balance SET balance = balance + ${points}, updated_at = now()
          WHERE tenant_id = ${ctx.tenantId} AND customer_id = ${redemption.customer_id}`
    );
    await ctx.db.execute(
      sql`INSERT INTO customer_points_transactions
            (tenant_id, customer_id, amount_points, transaction_type, reference_id, description, operator_user_id)
          VALUES (${ctx.tenantId}, ${redemption.customer_id}, ${points}, 'adjustment', ${settlement.id},
                  ${"Estorno por reabertura de comanda"}, ${ctx.actorUserId ?? null})`
    );
  }
  await ctx.db.execute(
    sql`DELETE FROM student_class_balance
        WHERE tenant_id = ${ctx.tenantId} AND settlement_id = ${settlement.id}`
  );
  await ctx.db.execute(
    sql`DELETE FROM comanda_payments
        WHERE tenant_id = ${ctx.tenantId} AND settlement_id = ${settlement.id}`
  );
  await ctx.db.execute(
    sql`UPDATE comanda_settlements
        SET status = 'reversed', reversed_by_user_id = ${ctx.actorUserId ?? null}, reversed_at = now()
        WHERE tenant_id = ${ctx.tenantId} AND comanda_id = ${input.comandaId} AND status = 'active'`
  );
  await ctx.db.execute(
    sql`UPDATE comanda_items SET membership_discount_percent = 0, membership_discount_cents = 0
        WHERE tenant_id = ${ctx.tenantId} AND comanda_id = ${input.comandaId}`
  );
  await ctx.db.execute(
    sql`UPDATE comandas SET gross_total_cents = NULL, membership_discount_cents = NULL,
            net_total_cents = NULL, applied_membership_plan_id = NULL, applied_membership_plan_name = NULL
        WHERE tenant_id = ${ctx.tenantId} AND id = ${input.comandaId}`
  );
  await audit(ctx, "membership.settlement.reversed", { comandaId: input.comandaId });
  return reopened;
}
