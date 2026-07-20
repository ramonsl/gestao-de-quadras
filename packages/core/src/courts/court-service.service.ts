import { sql } from "drizzle-orm";
import type { CourtService } from "@gestao-de-quadras/db/schema";
import { assertTenantId, rows, type TenantContext } from "../db/tenant";
import { assertCourtInTenant } from "./court.service";

export interface CreateCourtServiceInput {
  courtId: string;
  serviceType: "rental" | "single_class" | "package";
  basePriceInCents: number;
}

type CourtServiceRow = {
  id: string;
  tenant_id: string;
  court_id: string;
  service_type: string;
  base_price_in_cents: number;
  created_at: Date;
  updated_at: Date;
};

const COLS = sql`id, tenant_id, court_id, service_type, base_price_in_cents, created_at, updated_at`;

function toCourtService(row: CourtServiceRow): CourtService {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    courtId: row.court_id,
    serviceType: row.service_type,
    basePriceInCents: row.base_price_in_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCourtServices(
  ctx: TenantContext,
  courtId: string
): Promise<CourtService[]> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<CourtServiceRow>(
    sql`SELECT ${COLS} FROM court_services
        WHERE tenant_id = ${ctx.tenantId} AND court_id = ${courtId}`
  );
  return rows<CourtServiceRow>(result).map(toCourtService);
}

export async function createCourtService(
  ctx: TenantContext,
  input: CreateCourtServiceInput
): Promise<CourtService> {
  assertTenantId(ctx.tenantId);
  // Anti-IDOR: o courtId vem do formulário — revalida que é do tenant da sessão.
  await assertCourtInTenant(ctx, input.courtId);
  const result = await ctx.db.execute<CourtServiceRow>(
    sql`INSERT INTO court_services (tenant_id, court_id, service_type, base_price_in_cents)
        VALUES (${ctx.tenantId}, ${input.courtId}, ${input.serviceType}, ${input.basePriceInCents})
        RETURNING ${COLS}`
  );
  return toCourtService(rows<CourtServiceRow>(result)[0]);
}
