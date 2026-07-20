import { sql } from "drizzle-orm";
import type { Court } from "@gestao-de-quadras/db/schema";
import { assertSchema, rows, tenantTable, type TenantContext } from "../db/tenant";

/**
 * Quadras (CAD-03). Isolamento por schema-por-tenant via SQL cru (Regra #1).
 */

export interface CreateCourtInput {
  name: string;
  modality: string;
}

type CourtRow = {
  id: string;
  name: string;
  modality: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

const COURT_COLUMNS = sql`id, name, modality, is_active, created_at, updated_at`;

function toCourt(row: CourtRow): Court {
  return {
    id: row.id,
    name: row.name,
    modality: row.modality,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCourtsByTenant(ctx: TenantContext): Promise<Court[]> {
  assertSchema(ctx.schemaName);
  const result = await ctx.db.execute<CourtRow>(
    sql`SELECT ${COURT_COLUMNS} FROM ${tenantTable(ctx.schemaName, "courts")} ORDER BY name ASC`
  );
  return rows<CourtRow>(result).map(toCourt);
}

export async function getCourtById(ctx: TenantContext, courtId: string): Promise<Court | null> {
  assertSchema(ctx.schemaName);
  const result = await ctx.db.execute<CourtRow>(
    sql`SELECT ${COURT_COLUMNS} FROM ${tenantTable(ctx.schemaName, "courts")} WHERE id = ${courtId} LIMIT 1`
  );
  const row = rows<CourtRow>(result)[0];
  return row ? toCourt(row) : null;
}

export async function createCourt(ctx: TenantContext, input: CreateCourtInput): Promise<Court> {
  assertSchema(ctx.schemaName);
  const result = await ctx.db.execute<CourtRow>(
    sql`INSERT INTO ${tenantTable(ctx.schemaName, "courts")} (name, modality)
        VALUES (${input.name}, ${input.modality})
        RETURNING ${COURT_COLUMNS}`
  );
  return toCourt(rows<CourtRow>(result)[0]);
}
