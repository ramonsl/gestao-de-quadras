import { sql } from "drizzle-orm";
import type { Court } from "@gestao-de-quadras/db/schema";
import { assertTenantId, rows, type TenantContext } from "../db/tenant";

export interface CreateCourtInput {
  name: string;
  modality: string;
}

type CourtRow = {
  id: string;
  tenant_id: string;
  name: string;
  modality: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

const COLS = sql`id, tenant_id, name, modality, is_active, created_at, updated_at`;

function toCourt(row: CourtRow): Court {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    modality: row.modality,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCourtsByTenant(ctx: TenantContext): Promise<Court[]> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<CourtRow>(
    sql`SELECT ${COLS} FROM courts WHERE tenant_id = ${ctx.tenantId} ORDER BY name ASC`
  );
  return rows<CourtRow>(result).map(toCourt);
}

export async function getCourtById(ctx: TenantContext, courtId: string): Promise<Court | null> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<CourtRow>(
    sql`SELECT ${COLS} FROM courts WHERE id = ${courtId} AND tenant_id = ${ctx.tenantId} LIMIT 1`
  );
  const row = rows<CourtRow>(result)[0];
  return row ? toCourt(row) : null;
}

/**
 * Garante que `courtId` (vindo de input do usuário) pertence ao tenant da sessão
 * antes de vinculá-lo a um filho (Regra inviolável #1-b — anti-IDOR). Lança se
 * a quadra não existir nesta arena.
 */
export async function assertCourtInTenant(ctx: TenantContext, courtId: string): Promise<void> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<{ id: string }>(
    sql`SELECT id FROM courts WHERE id = ${courtId} AND tenant_id = ${ctx.tenantId} LIMIT 1`
  );
  if (rows<{ id: string }>(result).length === 0) {
    throw new Error("Quadra não encontrada nesta arena.");
  }
}

export async function createCourt(ctx: TenantContext, input: CreateCourtInput): Promise<Court> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<CourtRow>(
    sql`INSERT INTO courts (tenant_id, name, modality)
        VALUES (${ctx.tenantId}, ${input.name}, ${input.modality})
        RETURNING ${COLS}`
  );
  return toCourt(rows<CourtRow>(result)[0]);
}
