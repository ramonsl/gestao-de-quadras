import { z } from "zod";
import { sql } from "drizzle-orm";
import type { AdSpace } from "@gestao-de-quadras/db/schema";
import { assertTenantId, rows, type TenantContext } from "../db/tenant";

export const AD_SPACE_TYPES = ["placa_fisica", "lona", "banner_digital"] as const;
export const AD_SPACE_STATUSES = ["disponivel", "ocupado", "manutencao"] as const;

export const createAdSpaceInput = z.object({
  name: z.string().trim().min(1, "Informe a identificação do espaço.").max(120),
  spaceType: z.enum(AD_SPACE_TYPES),
  status: z.enum(AD_SPACE_STATUSES).default("disponivel"),
  referencePriceCents: z.number().int().positive("Valor de referência deve ser positivo."),
});

export const updateAdSpaceInput = createAdSpaceInput.partial();

type AdSpaceRow = {
  id: string;
  tenant_id: string;
  name: string;
  space_type: string;
  status: string;
  reference_price_cents: number;
  created_at: Date;
  updated_at: Date;
};

const COLS = sql`id, tenant_id, name, space_type, status, reference_price_cents, created_at, updated_at`;

function toAdSpace(row: AdSpaceRow): AdSpace {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    spaceType: row.space_type,
    status: row.status,
    referencePriceCents: row.reference_price_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

export async function createAdSpace(
  input: z.infer<typeof createAdSpaceInput>,
  ctx: TenantContext
): Promise<AdSpace> {
  assertTenantId(ctx.tenantId);
  const data = createAdSpaceInput.parse(input);
  const result = await ctx.db.execute<AdSpaceRow>(
    sql`INSERT INTO ad_spaces (tenant_id, name, space_type, status, reference_price_cents)
        VALUES (${ctx.tenantId}, ${data.name}, ${data.spaceType}, ${data.status}, ${data.referencePriceCents})
        RETURNING ${COLS}`
  );
  const space = toAdSpace(rows<AdSpaceRow>(result)[0]);
  await writeAudit(ctx, "ad_space:created", { adSpaceId: space.id, ...data });
  return space;
}

export async function listAdSpaces(ctx: TenantContext): Promise<AdSpace[]> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<AdSpaceRow>(
    sql`SELECT ${COLS} FROM ad_spaces WHERE tenant_id = ${ctx.tenantId} ORDER BY name ASC`
  );
  return rows<AdSpaceRow>(result).map(toAdSpace);
}

export async function getAdSpaceById(id: string, ctx: TenantContext): Promise<AdSpace | null> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<AdSpaceRow>(
    sql`SELECT ${COLS} FROM ad_spaces WHERE id = ${id} AND tenant_id = ${ctx.tenantId} LIMIT 1`
  );
  const row = rows<AdSpaceRow>(result)[0];
  return row ? toAdSpace(row) : null;
}

export async function updateAdSpace(
  id: string,
  input: z.infer<typeof updateAdSpaceInput>,
  ctx: TenantContext
): Promise<AdSpace | null> {
  assertTenantId(ctx.tenantId);
  const data = updateAdSpaceInput.parse(input);
  const sets: ReturnType<typeof sql>[] = [];
  if (data.name !== undefined) sets.push(sql`name = ${data.name}`);
  if (data.spaceType !== undefined) sets.push(sql`space_type = ${data.spaceType}`);
  if (data.status !== undefined) sets.push(sql`status = ${data.status}`);
  if (data.referencePriceCents !== undefined) sets.push(sql`reference_price_cents = ${data.referencePriceCents}`);
  sets.push(sql`updated_at = now()`);

  const result = await ctx.db.execute<AdSpaceRow>(
    sql`UPDATE ad_spaces SET ${sql.join(sets, sql`, `)}
        WHERE id = ${id} AND tenant_id = ${ctx.tenantId}
        RETURNING ${COLS}`
  );
  const row = rows<AdSpaceRow>(result)[0];
  if (!row) return null;
  await writeAudit(ctx, "ad_space:updated", { adSpaceId: id, changes: data });
  return toAdSpace(row);
}

export async function deleteAdSpace(id: string, ctx: TenantContext): Promise<boolean> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<{ id: string }>(
    sql`DELETE FROM ad_spaces WHERE id = ${id} AND tenant_id = ${ctx.tenantId} RETURNING id`
  );
  const deleted = rows<{ id: string }>(result).length > 0;
  if (deleted) await writeAudit(ctx, "ad_space:deleted", { adSpaceId: id });
  return deleted;
}
