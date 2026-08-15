import { z } from "zod";
import { sql } from "drizzle-orm";
import { assertTenantId, rows, type TenantContext } from "../db/tenant";

export interface ClassBalanceView {
  id: string;
  tenantId: string;
  globalCustomerId: string;
  classPackageId: string;
  packageName: string;
  remainingClasses: number;
  purchasedAt: Date;
  expiresAt: Date | null;
}

export type DebitOneClassResult =
  | {
      success: true;
      remainingClasses: number;
      packageName: string;
      globalCustomerId: string;
      customerWhatsapp: string | null;
    }
  | { success: false; reason: "balance_not_found" | "balance_exhausted" };

export const DebitOneClassInputSchema = z.object({
  studentClassBalanceId: z.string().uuid(),
});

type BalanceRow = {
  id: string;
  tenant_id: string;
  global_customer_id: string;
  class_package_id: string;
  package_name: string;
  remaining_classes: number;
  purchased_at: Date;
  expires_at: Date | null;
};

function toBalanceView(row: BalanceRow): ClassBalanceView {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    globalCustomerId: row.global_customer_id,
    classPackageId: row.class_package_id,
    packageName: row.package_name,
    remainingClasses: row.remaining_classes,
    purchasedAt: row.purchased_at,
    expiresAt: row.expires_at,
  };
}

export async function checkCustomerOptIn(
  ctx: TenantContext,
  globalCustomerId: string
): Promise<boolean> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<{ opt_in: boolean }>(
    sql`SELECT co.opt_in
        FROM customer_opt_in_lgpd co
        JOIN customers c ON c.id = co.customer_id AND c.tenant_id = co.tenant_id
        WHERE co.tenant_id = ${ctx.tenantId}
          AND c.global_customer_id = ${globalCustomerId}
          AND co.opt_in = true
        LIMIT 1`
  );
  return rows<{ opt_in: boolean }>(result).length > 0;
}

export async function getActiveBalancesForCustomer(
  ctx: TenantContext,
  globalCustomerId: string
): Promise<ClassBalanceView[]> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<BalanceRow>(
    sql`SELECT scb.id, scb.tenant_id, scb.global_customer_id, scb.class_package_id,
               cp.name AS package_name,
               scb.remaining_classes, scb.purchased_at, scb.expires_at
        FROM student_class_balance scb
        JOIN class_packages cp ON cp.id = scb.class_package_id AND cp.tenant_id = scb.tenant_id
        WHERE scb.tenant_id = ${ctx.tenantId}
          AND scb.global_customer_id = ${globalCustomerId}
          AND scb.remaining_classes > 0
        ORDER BY scb.expires_at ASC NULLS LAST, scb.purchased_at ASC`
  );
  return rows<BalanceRow>(result).map(toBalanceView);
}

export async function debitOneClass(
  ctx: TenantContext,
  input: z.infer<typeof DebitOneClassInputSchema>
): Promise<DebitOneClassResult> {
  assertTenantId(ctx.tenantId);
  if (!ctx.actorUserId) {
    throw new Error("debitOneClass exige ctx.actorUserId.");
  }
  const data = DebitOneClassInputSchema.parse(input);

  // Verifica que o balance pertence ao tenant antes de decrementar (IDOR guard)
  const checkResult = await ctx.db.execute<{ id: string; remaining_classes: number }>(
    sql`SELECT id, remaining_classes FROM student_class_balance
        WHERE id = ${data.studentClassBalanceId} AND tenant_id = ${ctx.tenantId} LIMIT 1`
  );
  const check = rows<{ id: string; remaining_classes: number }>(checkResult)[0];
  if (!check) return { success: false, reason: "balance_not_found" };

  // Decremento atômico — RETURNING garante que só há débito se remaining > 0
  const debitResult = await ctx.db.execute<{
    id: string;
    remaining_classes: number;
    global_customer_id: string;
    class_package_id: string;
  }>(
    sql`UPDATE student_class_balance
        SET remaining_classes = remaining_classes - 1, updated_at = now()
        WHERE id = ${data.studentClassBalanceId} AND tenant_id = ${ctx.tenantId}
          AND remaining_classes > 0
        RETURNING id, remaining_classes, global_customer_id, class_package_id`
  );
  const debitRow = rows<{ id: string; remaining_classes: number; global_customer_id: string; class_package_id: string }>(
    debitResult
  )[0];
  if (!debitRow) return { success: false, reason: "balance_exhausted" };

  // Registro de auditoria
  await ctx.db.execute(
    sql`INSERT INTO class_debit_log (tenant_id, student_class_balance_id, debited_by_user_id)
        VALUES (${ctx.tenantId}, ${data.studentClassBalanceId}, ${ctx.actorUserId})`
  );

  // Busca nome do pacote e whatsapp do cliente para a notificação
  const metaResult = await ctx.db.execute<{ package_name: string; whatsapp: string | null }>(
    sql`SELECT cp.name AS package_name, gc.whatsapp
        FROM class_packages cp, global_customers gc
        WHERE cp.id = ${debitRow.class_package_id} AND cp.tenant_id = ${ctx.tenantId}
          AND gc.id = ${debitRow.global_customer_id}
        LIMIT 1`
  );
  const meta = rows<{ package_name: string; whatsapp: string | null }>(metaResult)[0];

  return {
    success: true,
    remainingClasses: debitRow.remaining_classes,
    packageName: meta?.package_name ?? "Pacote de Aulas",
    globalCustomerId: debitRow.global_customer_id,
    customerWhatsapp: meta?.whatsapp ?? null,
  };
}
