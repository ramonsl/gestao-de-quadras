import { z } from "zod";
import { sql } from "drizzle-orm";
import type { Advertiser } from "@gestao-de-quadras/db/schema";
import { assertTenantId, rows, type TenantContext } from "../db/tenant";

/** CNPJ (14) ou CPF (11) — normaliza para apenas dígitos e valida o tamanho. */
const documentSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v.length === 11 || v.length === 14, {
    message: "Documento deve ser um CPF (11 dígitos) ou CNPJ (14 dígitos).",
  });

export const createAdvertiserInput = z.object({
  name: z.string().trim().min(1, "Informe a razão social/nome.").max(150),
  document: documentSchema,
  email: z.string().trim().toLowerCase().email("E-mail inválido.").optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().trim().max(20).optional().or(z.literal("").transform(() => undefined)),
});

export const updateAdvertiserInput = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  document: documentSchema.optional(),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().trim().max(20).optional().or(z.literal("").transform(() => undefined)),
});

export type CreateAdvertiserResult =
  | { success: true; advertiser: Advertiser }
  | { success: false; reason: "document_taken" };

type AdvertiserRow = {
  id: string;
  tenant_id: string;
  name: string;
  document: string;
  email: string | null;
  phone: string | null;
  created_at: Date;
  updated_at: Date;
};

const COLS = sql`id, tenant_id, name, document, email, phone, created_at, updated_at`;

function toAdvertiser(row: AdvertiserRow): Advertiser {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    document: row.document,
    email: row.email,
    phone: row.phone,
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

async function documentExists(ctx: TenantContext, document: string, excludeId?: string): Promise<boolean> {
  const result = await ctx.db.execute<{ id: string }>(
    sql`SELECT id FROM advertisers
        WHERE tenant_id = ${ctx.tenantId} AND document = ${document}
        ${excludeId ? sql`AND id <> ${excludeId}` : sql``}
        LIMIT 1`
  );
  return rows<{ id: string }>(result).length > 0;
}

export async function createAdvertiser(
  input: z.infer<typeof createAdvertiserInput>,
  ctx: TenantContext
): Promise<CreateAdvertiserResult> {
  assertTenantId(ctx.tenantId);
  const data = createAdvertiserInput.parse(input);

  if (await documentExists(ctx, data.document)) {
    return { success: false, reason: "document_taken" };
  }

  const result = await ctx.db.execute<AdvertiserRow>(
    sql`INSERT INTO advertisers (tenant_id, name, document, email, phone)
        VALUES (${ctx.tenantId}, ${data.name}, ${data.document}, ${data.email ?? null}, ${data.phone ?? null})
        RETURNING ${COLS}`
  );
  const advertiser = toAdvertiser(rows<AdvertiserRow>(result)[0]);
  await writeAudit(ctx, "advertiser:created", { advertiserId: advertiser.id, name: data.name });
  return { success: true, advertiser };
}

export async function listAdvertisers(ctx: TenantContext): Promise<Advertiser[]> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<AdvertiserRow>(
    sql`SELECT ${COLS} FROM advertisers WHERE tenant_id = ${ctx.tenantId} ORDER BY name ASC`
  );
  return rows<AdvertiserRow>(result).map(toAdvertiser);
}

export async function getAdvertiserById(id: string, ctx: TenantContext): Promise<Advertiser | null> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<AdvertiserRow>(
    sql`SELECT ${COLS} FROM advertisers WHERE id = ${id} AND tenant_id = ${ctx.tenantId} LIMIT 1`
  );
  const row = rows<AdvertiserRow>(result)[0];
  return row ? toAdvertiser(row) : null;
}

export async function updateAdvertiser(
  id: string,
  input: z.infer<typeof updateAdvertiserInput>,
  ctx: TenantContext
): Promise<{ success: true; advertiser: Advertiser } | { success: false; reason: "not_found" | "document_taken" }> {
  assertTenantId(ctx.tenantId);
  const data = updateAdvertiserInput.parse(input);

  if (data.document && (await documentExists(ctx, data.document, id))) {
    return { success: false, reason: "document_taken" };
  }

  const sets: ReturnType<typeof sql>[] = [];
  if (data.name !== undefined) sets.push(sql`name = ${data.name}`);
  if (data.document !== undefined) sets.push(sql`document = ${data.document}`);
  if (data.email !== undefined) sets.push(sql`email = ${data.email ?? null}`);
  if (data.phone !== undefined) sets.push(sql`phone = ${data.phone ?? null}`);
  sets.push(sql`updated_at = now()`);

  const result = await ctx.db.execute<AdvertiserRow>(
    sql`UPDATE advertisers SET ${sql.join(sets, sql`, `)}
        WHERE id = ${id} AND tenant_id = ${ctx.tenantId}
        RETURNING ${COLS}`
  );
  const row = rows<AdvertiserRow>(result)[0];
  if (!row) return { success: false, reason: "not_found" };
  await writeAudit(ctx, "advertiser:updated", { advertiserId: id, changes: { ...data } });
  return { success: true, advertiser: toAdvertiser(row) };
}

export async function deleteAdvertiser(id: string, ctx: TenantContext): Promise<boolean> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<{ id: string }>(
    sql`DELETE FROM advertisers WHERE id = ${id} AND tenant_id = ${ctx.tenantId} RETURNING id`
  );
  const deleted = rows<{ id: string }>(result).length > 0;
  if (deleted) await writeAudit(ctx, "advertiser:deleted", { advertiserId: id });
  return deleted;
}
