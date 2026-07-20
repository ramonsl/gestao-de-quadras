import { sql } from "drizzle-orm";
import type { CourtService } from "@gestao-de-quadras/db/schema";
import { assertSchema, rows, tenantTable, type TenantContext } from "../db/tenant";

/**
 * Serviços de quadra (CAD-03): locação, aula avulsa, pacote.
 * `basePriceInCents` já chega em centavos (integer).
 */

export interface CreateCourtServiceInput {
  courtId: string;
  serviceType: "rental" | "single_class" | "package";
  basePriceInCents: number;
}

type CourtServiceRow = {
  id: string;
  court_id: string;
  service_type: string;
  base_price_in_cents: number;
  created_at: Date;
  updated_at: Date;
};

const COLUMNS = sql`id, court_id, service_type, base_price_in_cents, created_at, updated_at`;

function toCourtService(row: CourtServiceRow): CourtService {
  return {
    id: row.id,
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
  assertSchema(ctx.schemaName);
  const result = await ctx.db.execute<CourtServiceRow>(
    sql`SELECT ${COLUMNS} FROM ${tenantTable(ctx.schemaName, "court_services")}
        WHERE court_id = ${courtId}`
  );
  return rows<CourtServiceRow>(result).map(toCourtService);
}

export async function createCourtService(
  ctx: TenantContext,
  input: CreateCourtServiceInput
): Promise<CourtService> {
  assertSchema(ctx.schemaName);
  const result = await ctx.db.execute<CourtServiceRow>(
    sql`INSERT INTO ${tenantTable(ctx.schemaName, "court_services")}
          (court_id, service_type, base_price_in_cents)
        VALUES (${input.courtId}, ${input.serviceType}, ${input.basePriceInCents})
        RETURNING ${COLUMNS}`
  );
  return toCourtService(rows<CourtServiceRow>(result)[0]);
}
