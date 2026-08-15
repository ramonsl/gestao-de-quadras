import { z } from "zod";
import { sql } from "drizzle-orm";
import { assertTenantId, rows, type TenantContext } from "../db/tenant";

// ── Tipos públicos ─────────────────────────────────────────────────────────

export interface PrintConfigView {
  id?: string;
  tenantId: string;
  paperSize: "58mm" | "80mm";
  autoPrintProductionTickets: boolean;
  receiptHeader: string | null;
  receiptFooter: string | null;
}

// ── Zod — entrada da action ────────────────────────────────────────────────

export const UpsertPrintConfigInputSchema = z.object({
  paperSize: z.enum(["58mm", "80mm"]).default("80mm"),
  autoPrintProductionTickets: z.boolean().default(false),
  receiptHeader: z.string().max(500).nullable().default(null),
  receiptFooter: z.string().max(500).nullable().default(null),
});

export type UpsertPrintConfigInput = z.infer<typeof UpsertPrintConfigInputSchema>;

// ── Linha interna (resultado do SQL bruto) ─────────────────────────────────

type PrintConfigRow = {
  id: string;
  tenant_id: string;
  paper_size: string;
  auto_print_production_tickets: boolean;
  receipt_header: string | null;
  receipt_footer: string | null;
};

// ── Default sem linha no banco ─────────────────────────────────────────────

const defaultConfig = (tenantId: string): PrintConfigView => ({
  tenantId,
  paperSize: "80mm",
  autoPrintProductionTickets: false,
  receiptHeader: null,
  receiptFooter: null,
});

function toView(row: PrintConfigRow): PrintConfigView {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    paperSize: row.paper_size as "58mm" | "80mm",
    autoPrintProductionTickets: Boolean(row.auto_print_production_tickets),
    receiptHeader: row.receipt_header,
    receiptFooter: row.receipt_footer,
  };
}

// ── Funções públicas ───────────────────────────────────────────────────────

export async function getPrintConfig(ctx: TenantContext): Promise<PrintConfigView> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<PrintConfigRow>(
    sql`SELECT id, tenant_id, paper_size, auto_print_production_tickets,
               receipt_header, receipt_footer
        FROM tenant_print_configs
        WHERE tenant_id = ${ctx.tenantId}
        LIMIT 1`
  );
  const row = rows<PrintConfigRow>(result)[0];
  if (!row) return defaultConfig(ctx.tenantId);
  return toView(row);
}

export async function upsertPrintConfig(
  ctx: TenantContext,
  input: UpsertPrintConfigInput
): Promise<PrintConfigView> {
  assertTenantId(ctx.tenantId);
  if (!ctx.actorUserId) {
    throw new Error("upsertPrintConfig exige ctx.actorUserId.");
  }
  const data = UpsertPrintConfigInputSchema.parse(input);

  const result = await ctx.db.execute<PrintConfigRow>(
    sql`INSERT INTO tenant_print_configs (
          tenant_id, paper_size, auto_print_production_tickets,
          receipt_header, receipt_footer
        )
        VALUES (
          ${ctx.tenantId}, ${data.paperSize}, ${data.autoPrintProductionTickets},
          ${data.receiptHeader}, ${data.receiptFooter}
        )
        ON CONFLICT (tenant_id) DO UPDATE SET
          paper_size = EXCLUDED.paper_size,
          auto_print_production_tickets = EXCLUDED.auto_print_production_tickets,
          receipt_header = EXCLUDED.receipt_header,
          receipt_footer = EXCLUDED.receipt_footer,
          updated_at = now()
        RETURNING id, tenant_id, paper_size, auto_print_production_tickets,
                  receipt_header, receipt_footer`
  );
  await ctx.db.execute(
    sql`INSERT INTO audit_logs (tenant_id, user_id, action, details)
        VALUES (${ctx.tenantId}, ${ctx.actorUserId}, ${"print_config_updated"},
                ${JSON.stringify({ paperSize: data.paperSize, autoPrintProductionTickets: data.autoPrintProductionTickets })})`
  );
  return toView(rows<PrintConfigRow>(result)[0]);
}
