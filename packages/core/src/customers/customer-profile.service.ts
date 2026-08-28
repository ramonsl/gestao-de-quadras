import { sql } from "drizzle-orm";
import { assertTenantId, rows, type TenantContext } from "../db/tenant";
import { getCustomerById, type LocalCustomer } from "./customer.service";
import {
  getCustomerDebitSummary,
  CUSTOMER_DEBIT_LIMIT_CENTS,
} from "../pdv/customer-debit.service";
import { getCustomerPointsSummary, type CustomerPointsSummary } from "../points/points.service";

/**
 * CAD-08 — Perfil 360° e Histórico Consolidado do Cliente.
 *
 * Serviço APENAS DE LEITURA que compõe os serviços já existentes (débito,
 * pontos) e agrega comandas e saldo de aulas em uma única visão consolidada,
 * estritamente isolada por tenant (regra 1). Nenhum dado cruza arenas — mesmo
 * o saldo de aulas (indexado por `global_customer_id`) é filtrado por
 * `tenant_id` (regra 8).
 */

// --- Comandas e Vendas (Aba 1) ----------------------------------------------

export interface CustomerComandaHistoryItem {
  id: string;
  status: "open" | "closed";
  openedAt: Date;
  /** Nº de linhas de item lançadas na comanda. */
  itemCount: number;
  /** Total via snapshot imutável (quantity * unit_price_cents_at_sale) — regra 10. */
  totalCents: number;
  /** Meios de pagamento distintos registrados (vazio para comandas abertas). */
  paymentMethods: string[];
}

type ComandaAggRow = {
  id: string;
  status: string;
  created_at: Date;
  item_count: number | string;
  total_cents: number | string;
};

type ComandaPaymentMethodRow = {
  comanda_id: string;
  payment_method: string;
};

/**
 * Lista cronológica (mais recente primeiro) de todas as comandas do cliente na
 * arena atual, com total via snapshot de preço e meios de pagamento distintos.
 */
export async function listCustomerComandas(
  ctx: TenantContext,
  customerId: string
): Promise<CustomerComandaHistoryItem[]> {
  assertTenantId(ctx.tenantId);
  if (!customerId) return [];

  const aggResult = await ctx.db.execute<ComandaAggRow>(
    sql`SELECT c.id, c.status, c.created_at,
               COUNT(ci.id) AS item_count,
               COALESCE(SUM(ci.quantity * ci.unit_price_cents_at_sale), 0) AS total_cents
        FROM comandas c
        LEFT JOIN comanda_items ci
          ON ci.comanda_id = c.id AND ci.tenant_id = c.tenant_id
        WHERE c.tenant_id = ${ctx.tenantId} AND c.customer_id = ${customerId}
        GROUP BY c.id, c.status, c.created_at
        ORDER BY c.created_at DESC`
  );
  const aggRows = rows<ComandaAggRow>(aggResult);
  if (aggRows.length === 0) return [];

  const paymentResult = await ctx.db.execute<ComandaPaymentMethodRow>(
    sql`SELECT DISTINCT cp.comanda_id, cp.payment_method
        FROM comanda_payments cp
        JOIN comandas c ON c.id = cp.comanda_id AND c.tenant_id = cp.tenant_id
        WHERE cp.tenant_id = ${ctx.tenantId} AND c.customer_id = ${customerId}`
  );
  const methodsByComanda = new Map<string, string[]>();
  for (const row of rows<ComandaPaymentMethodRow>(paymentResult)) {
    const list = methodsByComanda.get(row.comanda_id) ?? [];
    list.push(row.payment_method);
    methodsByComanda.set(row.comanda_id, list);
  }

  return aggRows.map((row) => ({
    id: row.id,
    status: row.status === "closed" ? "closed" : "open",
    openedAt: row.created_at,
    itemCount: Number(row.item_count),
    totalCents: Number(row.total_cents),
    paymentMethods: methodsByComanda.get(row.id) ?? [],
  }));
}

// --- Saldo de Pacotes de Aulas (Card + Aba 3) -------------------------------

export interface CustomerClassBalanceItem {
  packageName: string;
  remainingClasses: number;
  totalClassCount: number;
  purchasedAt: Date;
  expiresAt: Date | null;
}

type ClassBalanceRow = {
  package_name: string;
  remaining_classes: number | string;
  total_class_count: number | string;
  purchased_at: Date;
  expires_at: Date | null;
};

/**
 * Saldo de pacotes de aulas do cliente. A tabela `student_class_balance` é
 * indexada pela identidade global (`global_customer_id`), mas ainda assim é
 * filtrada por `tenant_id` — o saldo é isolado por arena (regra 8). Retorna
 * vazio quando o cliente não tem identidade global vinculada.
 */
export async function listCustomerClassBalances(
  ctx: TenantContext,
  globalCustomerId: string | null
): Promise<CustomerClassBalanceItem[]> {
  assertTenantId(ctx.tenantId);
  if (!globalCustomerId) return [];

  const result = await ctx.db.execute<ClassBalanceRow>(
    sql`SELECT cp.name AS package_name,
               scb.remaining_classes,
               cp.total_class_count,
               scb.purchased_at,
               scb.expires_at
        FROM student_class_balance scb
        JOIN class_packages cp
          ON cp.id = scb.class_package_id AND cp.tenant_id = scb.tenant_id
        WHERE scb.tenant_id = ${ctx.tenantId} AND scb.global_customer_id = ${globalCustomerId}
        ORDER BY scb.purchased_at DESC`
  );
  return rows<ClassBalanceRow>(result).map((row) => ({
    packageName: row.package_name,
    remainingClasses: Number(row.remaining_classes),
    totalClassCount: Number(row.total_class_count),
    purchasedAt: row.purchased_at,
    expiresAt: row.expires_at,
  }));
}

// --- Opt-in LGPD (badge do cabeçalho) ---------------------------------------

export interface CustomerOptInStatus {
  optIn: boolean;
  changedAt: Date | null;
}

type OptInRow = { opt_in: boolean; changed_at: Date | null };

/** Consentimento LGPD atual do cliente na arena (default: não consentido). */
export async function getCustomerOptInStatus(
  ctx: TenantContext,
  customerId: string
): Promise<CustomerOptInStatus> {
  assertTenantId(ctx.tenantId);
  if (!customerId) return { optIn: false, changedAt: null };

  const result = await ctx.db.execute<OptInRow>(
    sql`SELECT opt_in, changed_at FROM customer_opt_in_lgpd
        WHERE tenant_id = ${ctx.tenantId} AND customer_id = ${customerId}
        LIMIT 1`
  );
  const row = rows<OptInRow>(result)[0];
  return row ? { optIn: Boolean(row.opt_in), changedAt: row.changed_at } : { optIn: false, changedAt: null };
}

// --- Agregador único (Perfil 360°) ------------------------------------------

export interface CustomerProfileDebitLine {
  id: string;
  comandaId: string | null;
  amountCents: number;
  paidCents: number;
  remainingCents: number;
  createdAt: Date;
}

export interface CustomerProfileDebit {
  totalPendingCents: number;
  limitCents: number;
  /** Percentual do limite utilizado (0–100+, arredondado). */
  usagePercent: number;
  /** Saldo devedor atingiu ou excedeu o limite → novas comandas/reservas bloqueadas. */
  isBlocked: boolean;
  /** Débitos em aberto que compõem o saldo (Aba de Saldo Devedor). */
  pendingDebits: CustomerProfileDebitLine[];
}

export interface CustomerProfileLtv {
  /** Total gasto em comandas fechadas (centavos). */
  totalSpentCents: number;
  comandaCount: number;
  /** Locações de quadra — 0 até RES-01/PDV-05 existirem. */
  rentalCount: number;
}

export interface CustomerProfile360 {
  customer: LocalCustomer;
  optIn: CustomerOptInStatus;
  /** Aniversário no mês corrente — destaque promocional (CRM-01). */
  isBirthdayThisMonth: boolean;
  debit: CustomerProfileDebit;
  points: CustomerPointsSummary;
  classBalances: CustomerClassBalanceItem[];
  ltv: CustomerProfileLtv;
  comandas: CustomerComandaHistoryItem[];
  membership: {
    planName: string;
    startsOn: string;
    endsOn: string | null;
    eligibleToday: boolean;
  } | null;
}

async function getCustomerMembershipSummary(ctx: TenantContext, customerId: string) {
  const result = await ctx.db.execute<{
    plan_name: string;
    starts_on: string;
    ends_on: string | null;
    eligible_today: boolean;
  }>(sql`SELECT mp.name AS plan_name, cm.starts_on, cm.ends_on,
                (mp.is_active = true
                 AND cm.starts_on <= (now() AT TIME ZONE 'UTC')::date
                 AND (cm.ends_on IS NULL OR cm.ends_on >= (now() AT TIME ZONE 'UTC')::date)) AS eligible_today
         FROM customer_memberships cm
         JOIN membership_plans mp ON mp.id = cm.membership_plan_id AND mp.tenant_id = cm.tenant_id
         WHERE cm.tenant_id = ${ctx.tenantId} AND cm.customer_id = ${customerId} AND cm.status = 'active'
         LIMIT 1`);
  const row = rows<{
    plan_name: string;
    starts_on: string;
    ends_on: string | null;
    eligible_today: boolean;
  }>(result)[0];
  return row ? {
    planName: row.plan_name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    eligibleToday: row.eligible_today,
  } : null;
}

function isBirthdayThisMonth(birthDate: string | null, now: Date): boolean {
  if (!birthDate || birthDate.length < 7) return false;
  // birthDate é coluna `date` (YYYY-MM-DD); compara o mês sem depender de timezone.
  const month = Number(birthDate.slice(5, 7));
  return month === now.getUTCMonth() + 1;
}

/**
 * Monta a visão consolidada do Perfil 360° do cliente. Retorna `null` se o
 * cliente não pertence a este tenant (guarda IDOR, regra 1b) — a rota deve
 * redirecionar nesse caso. Leituras independentes rodam em paralelo para o AC
 * de desempenho (< 1s).
 */
export async function getCustomerProfile360(
  ctx: TenantContext,
  customerId: string,
  now: Date = new Date()
): Promise<CustomerProfile360 | null> {
  assertTenantId(ctx.tenantId);

  const customer = await getCustomerById(ctx, customerId);
  if (!customer) return null;

  const [optIn, debitSummary, points, classBalances, comandas, membership] = await Promise.all([
    getCustomerOptInStatus(ctx, customerId),
    getCustomerDebitSummary(ctx, customerId),
    getCustomerPointsSummary(ctx, customerId),
    listCustomerClassBalances(ctx, customer.globalCustomerId),
    listCustomerComandas(ctx, customerId),
    getCustomerMembershipSummary(ctx, customerId),
  ]);

  const totalPendingCents = debitSummary.totalPendingCents;
  const usagePercent =
    CUSTOMER_DEBIT_LIMIT_CENTS > 0
      ? Math.round((totalPendingCents / CUSTOMER_DEBIT_LIMIT_CENTS) * 100)
      : 0;

  const closedComandas = comandas.filter((c) => c.status === "closed");
  const totalSpentCents = closedComandas.reduce((sum, c) => sum + c.totalCents, 0);

  return {
    customer,
    optIn,
    isBirthdayThisMonth: isBirthdayThisMonth(customer.birthDate, now),
    debit: {
      totalPendingCents,
      limitCents: CUSTOMER_DEBIT_LIMIT_CENTS,
      usagePercent,
      isBlocked: totalPendingCents >= CUSTOMER_DEBIT_LIMIT_CENTS,
      pendingDebits: debitSummary.pendingDebits.map((d) => ({
        id: d.id,
        comandaId: d.comandaId,
        amountCents: d.amountCents,
        paidCents: d.paidCents,
        remainingCents: d.amountCents - d.paidCents,
        createdAt: d.createdAt,
      })),
    },
    points,
    classBalances,
    ltv: {
      totalSpentCents,
      comandaCount: comandas.length,
      rentalCount: 0,
    },
    comandas,
    membership,
  };
}
