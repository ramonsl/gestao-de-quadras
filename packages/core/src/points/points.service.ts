import { z } from "zod";
import { sql } from "drizzle-orm";
import { assertTenantId, rows, type TenantContext } from "../db/tenant";

export interface PointsSettingsView {
  id?: string;
  tenantId: string;
  enabled: boolean;
  earnRateCentsPerPoint: number;
  /** Taxa por categoria — null = usar a taxa padrão (earnRateCentsPerPoint); 0 = sem acúmulo. */
  earnRateCopa: number | null;
  earnRateCourtRental: number | null;
  earnRateClassPackage: number | null;
  redemptionPointsPerReal: number;
  maxRedemptionPercentage: number;
  allowPartialRedemption: boolean;
  allowedParticipants: "all" | "affiliates_only";
  expirationDays: number;
}

export interface CustomerPointsSummary {
  enabled: boolean;
  customerId: string;
  balancePoints: number;
  balanceValueCents: number;
  redemptionPointsPerReal: number;
  maxRedemptionPercentage: number;
  maxAllowedRedemptionCents: number;
  maxAllowedPoints: number;
}

export const UpsertPointsSettingsInputSchema = z.object({
  enabled: z.boolean(),
  earnRateCentsPerPoint: z.number().int().positive().default(100),
  /** null = usar taxa padrão; 0 = sem acúmulo para esta categoria; >0 = taxa específica. */
  earnRateCopa: z.number().int().min(0).nullable().default(null),
  earnRateCourtRental: z.number().int().min(0).nullable().default(null),
  earnRateClassPackage: z.number().int().min(0).nullable().default(null),
  redemptionPointsPerReal: z.number().int().positive().default(100),
  maxRedemptionPercentage: z.number().int().min(0).max(100).default(50),
  allowPartialRedemption: z.boolean().default(true),
  allowedParticipants: z.enum(["all", "affiliates_only"]).default("all"),
  expirationDays: z.number().int().positive().default(180),
});

type PointsSettingsRow = {
  id: string;
  tenant_id: string;
  enabled: boolean;
  earn_rate_cents_per_point: number;
  earn_rate_copa: number | null;
  earn_rate_court_rental: number | null;
  earn_rate_class_package: number | null;
  redemption_points_per_real: number;
  max_redemption_percentage: number;
  allow_partial_redemption: boolean;
  allowed_participants: string;
  expiration_days: number;
};

type PointsBalanceRow = {
  id: string;
  tenant_id: string;
  customer_id: string;
  balance: number;
};

const DEFAULT_SETTINGS: (tenantId: string) => PointsSettingsView = (tenantId) => ({
  tenantId,
  enabled: false,
  earnRateCentsPerPoint: 100,
  earnRateCopa: null,
  earnRateCourtRental: null,
  earnRateClassPackage: null,
  redemptionPointsPerReal: 100,
  maxRedemptionPercentage: 50,
  allowPartialRedemption: true,
  allowedParticipants: "all",
  expirationDays: 180,
});

function toSettingsView(row: PointsSettingsRow): PointsSettingsView {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    enabled: Boolean(row.enabled),
    earnRateCentsPerPoint: Number(row.earn_rate_cents_per_point),
    earnRateCopa: row.earn_rate_copa != null ? Number(row.earn_rate_copa) : null,
    earnRateCourtRental: row.earn_rate_court_rental != null ? Number(row.earn_rate_court_rental) : null,
    earnRateClassPackage: row.earn_rate_class_package != null ? Number(row.earn_rate_class_package) : null,
    redemptionPointsPerReal: Number(row.redemption_points_per_real),
    maxRedemptionPercentage: Number(row.max_redemption_percentage),
    allowPartialRedemption: Boolean(row.allow_partial_redemption),
    allowedParticipants: row.allowed_participants as "all" | "affiliates_only",
    expirationDays: Number(row.expiration_days),
  };
}

export async function getPointsSettings(ctx: TenantContext): Promise<PointsSettingsView> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<PointsSettingsRow>(
    sql`SELECT id, tenant_id, enabled, earn_rate_cents_per_point,
               earn_rate_copa, earn_rate_court_rental, earn_rate_class_package,
               redemption_points_per_real, max_redemption_percentage,
               allow_partial_redemption, allowed_participants, expiration_days
        FROM points_settings
        WHERE tenant_id = ${ctx.tenantId}
        LIMIT 1`
  );
  const row = rows<PointsSettingsRow>(result)[0];
  if (!row) return DEFAULT_SETTINGS(ctx.tenantId);
  return toSettingsView(row);
}

export async function upsertPointsSettings(
  ctx: TenantContext,
  input: z.infer<typeof UpsertPointsSettingsInputSchema>
): Promise<PointsSettingsView> {
  assertTenantId(ctx.tenantId);
  if (!ctx.actorUserId) {
    throw new Error("upsertPointsSettings exige ctx.actorUserId.");
  }
  const data = UpsertPointsSettingsInputSchema.parse(input);

  const result = await ctx.db.execute<PointsSettingsRow>(
    sql`INSERT INTO points_settings (
          tenant_id, enabled, earn_rate_cents_per_point,
          earn_rate_copa, earn_rate_court_rental, earn_rate_class_package,
          redemption_points_per_real, max_redemption_percentage,
          allow_partial_redemption, allowed_participants, expiration_days
        )
        VALUES (
          ${ctx.tenantId}, ${data.enabled}, ${data.earnRateCentsPerPoint},
          ${data.earnRateCopa}, ${data.earnRateCourtRental}, ${data.earnRateClassPackage},
          ${data.redemptionPointsPerReal}, ${data.maxRedemptionPercentage},
          ${data.allowPartialRedemption}, ${data.allowedParticipants}, ${data.expirationDays}
        )
        ON CONFLICT (tenant_id) DO UPDATE SET
          enabled = EXCLUDED.enabled,
          earn_rate_cents_per_point = EXCLUDED.earn_rate_cents_per_point,
          earn_rate_copa = EXCLUDED.earn_rate_copa,
          earn_rate_court_rental = EXCLUDED.earn_rate_court_rental,
          earn_rate_class_package = EXCLUDED.earn_rate_class_package,
          redemption_points_per_real = EXCLUDED.redemption_points_per_real,
          max_redemption_percentage = EXCLUDED.max_redemption_percentage,
          allow_partial_redemption = EXCLUDED.allow_partial_redemption,
          allowed_participants = EXCLUDED.allowed_participants,
          expiration_days = EXCLUDED.expiration_days,
          updated_at = now()
        RETURNING id, tenant_id, enabled, earn_rate_cents_per_point,
                  earn_rate_copa, earn_rate_court_rental, earn_rate_class_package,
                  redemption_points_per_real, max_redemption_percentage,
                  allow_partial_redemption, allowed_participants, expiration_days`
  );
  return toSettingsView(rows<PointsSettingsRow>(result)[0]);
}

export async function getCustomerPointsSummary(
  ctx: TenantContext,
  customerId: string,
  comandaTotalCents?: number
): Promise<CustomerPointsSummary> {
  assertTenantId(ctx.tenantId);
  if (!z.string().uuid().safeParse(customerId).success) {
    throw new Error("customerId inválido.");
  }

  const settings = await getPointsSettings(ctx);
  if (!settings.enabled) {
    return {
      enabled: false,
      customerId,
      balancePoints: 0,
      balanceValueCents: 0,
      redemptionPointsPerReal: settings.redemptionPointsPerReal,
      maxRedemptionPercentage: settings.maxRedemptionPercentage,
      maxAllowedRedemptionCents: 0,
      maxAllowedPoints: 0,
    };
  }

  const balanceResult = await ctx.db.execute<PointsBalanceRow>(
    sql`SELECT balance FROM customer_points_balance
        WHERE tenant_id = ${ctx.tenantId} AND customer_id = ${customerId}
        LIMIT 1`
  );
  const balanceRow = rows<PointsBalanceRow>(balanceResult)[0];
  const balancePoints = balanceRow ? Number(balanceRow.balance) : 0;

  // 1 real (100 centavos) = redemptionPointsPerReal pontos
  const balanceValueCents = Math.floor((balancePoints * 100) / settings.redemptionPointsPerReal);

  let maxAllowedRedemptionCents = balanceValueCents;
  if (comandaTotalCents !== undefined && comandaTotalCents > 0) {
    const maxByPercentageCents = Math.floor(comandaTotalCents * (settings.maxRedemptionPercentage / 100));
    maxAllowedRedemptionCents = Math.min(balanceValueCents, maxByPercentageCents, comandaTotalCents);
  }

  const maxAllowedPoints = Math.floor((maxAllowedRedemptionCents * settings.redemptionPointsPerReal) / 100);

  return {
    enabled: true,
    customerId,
    balancePoints,
    balanceValueCents,
    redemptionPointsPerReal: settings.redemptionPointsPerReal,
    maxRedemptionPercentage: settings.maxRedemptionPercentage,
    maxAllowedRedemptionCents,
    maxAllowedPoints,
  };
}

export async function redeemPoints(
  ctx: TenantContext,
  customerId: string,
  pointsToRedeem: number,
  referenceId: string,
  description?: string
): Promise<{ success: boolean; pointsRedeemed: number; remainingBalance: number }> {
  assertTenantId(ctx.tenantId);
  if (!ctx.actorUserId) {
    throw new Error("redeemPoints exige ctx.actorUserId.");
  }
  if (pointsToRedeem <= 0) {
    return { success: false, pointsRedeemed: 0, remainingBalance: 0 };
  }

  const balanceResult = await ctx.db.execute<PointsBalanceRow>(
    sql`SELECT balance FROM customer_points_balance
        WHERE tenant_id = ${ctx.tenantId} AND customer_id = ${customerId}
        LIMIT 1`
  );
  const balanceRow = rows<PointsBalanceRow>(balanceResult)[0];
  const currentBalance = balanceRow ? Number(balanceRow.balance) : 0;

  if (currentBalance < pointsToRedeem) {
    return { success: false, pointsRedeemed: 0, remainingBalance: currentBalance };
  }

  const newBalance = currentBalance - pointsToRedeem;

  // Atualiza ou insere saldo
  await ctx.db.execute(
    sql`INSERT INTO customer_points_balance (tenant_id, customer_id, balance)
        VALUES (${ctx.tenantId}, ${customerId}, ${newBalance})
        ON CONFLICT (tenant_id, customer_id) DO UPDATE SET
          balance = ${newBalance},
          updated_at = now()`
  );

  // Registra movimentação de débito no extrato
  await ctx.db.execute(
    sql`INSERT INTO customer_points_transactions (
          tenant_id, customer_id, amount_points, transaction_type, reference_id, description, operator_user_id
        )
        VALUES (
          ${ctx.tenantId}, ${customerId}, ${-pointsToRedeem}, 'redeem', ${referenceId},
          ${description ?? "Resgate de pontos como pagamento de comanda"}, ${ctx.actorUserId}
        )`
  );

  return { success: true, pointsRedeemed: pointsToRedeem, remainingBalance: newBalance };
}
