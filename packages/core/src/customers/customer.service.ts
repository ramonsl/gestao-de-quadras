import { z } from "zod";
import { sql } from "drizzle-orm";
import { assertSchema, rows, tenantTable, type ArenaDb, type TenantContext } from "../db/tenant";

const WHATSAPP_E164_REGEX = /^\+(?:[0-9] ?){6,14}[0-9]$/;

export const WhatsappSchema = z
  .string()
  .regex(WHATSAPP_E164_REGEX, "WhatsApp inválido — use formato E.164 (ex: +5511999999999)");

export const CreateGlobalCustomerInputSchema = z.object({
  whatsapp: WhatsappSchema,
  name: z.string().min(1).max(100),
  email: z.string().email().optional().nullable(),
  birthDate: z.date().optional().nullable(),
});

export type CreateGlobalCustomerInput = z.infer<typeof CreateGlobalCustomerInputSchema>;

export interface GlobalCustomer {
  id: string;
  whatsapp: string;
  name: string;
  email: string | null;
  /** Coluna `date` do Postgres — o driver retorna string ISO (YYYY-MM-DD). */
  birthDate: string | null;
  photoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalCustomer {
  id: string;
  globalCustomerId: string | null;
  whatsapp: string;
  name: string;
  email: string | null;
  birthDate: string | null;
  status: string;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

type GlobalCustomerRow = {
  id: string;
  whatsapp: string;
  name: string;
  email: string | null;
  birth_date: string | null;
  photo_url: string | null;
  created_at: Date;
  updated_at: Date;
};

type LocalCustomerRow = {
  id: string;
  global_customer_id: string | null;
  whatsapp: string;
  name: string;
  email: string | null;
  birth_date: string | null;
  status: string;
  created_by_user_id: string;
  created_at: Date;
  updated_at: Date;
};

const GLOBAL_COLUMNS = sql`id, whatsapp, name, email, birth_date, photo_url, created_at, updated_at`;
const LOCAL_COLUMNS = sql`id, global_customer_id, whatsapp, name, email, birth_date, status, created_by_user_id, created_at, updated_at`;

/** Converte Date → 'YYYY-MM-DD' para colunas `date` do Postgres. */
function toDateColumn(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function toGlobal(row: GlobalCustomerRow): GlobalCustomer {
  return {
    id: row.id,
    whatsapp: row.whatsapp,
    name: row.name,
    email: row.email,
    birthDate: row.birth_date,
    photoUrl: row.photo_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toLocal(row: LocalCustomerRow): LocalCustomer {
  return {
    id: row.id,
    globalCustomerId: row.global_customer_id,
    whatsapp: row.whatsapp,
    name: row.name,
    email: row.email,
    birthDate: row.birth_date,
    status: row.status,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Identidade GLOBAL (schema public) — compartilhada entre arenas
// ---------------------------------------------------------------------------

export async function findOrCreateGlobalCustomer(
  db: ArenaDb,
  whatsapp: string
): Promise<{ found: boolean; customer: GlobalCustomer }> {
  const validated = WhatsappSchema.parse(whatsapp);
  const result = await db.execute<GlobalCustomerRow>(
    sql`SELECT ${GLOBAL_COLUMNS} FROM global_customers WHERE whatsapp = ${validated} LIMIT 1`
  );
  const row = rows<GlobalCustomerRow>(result)[0];
  if (row) return { found: true, customer: toGlobal(row) };
  return { found: false, customer: {} as GlobalCustomer };
}

export async function createGlobalCustomer(
  db: ArenaDb,
  input: CreateGlobalCustomerInput
): Promise<GlobalCustomer> {
  const data = CreateGlobalCustomerInputSchema.parse(input);
  const result = await db.execute<GlobalCustomerRow>(
    sql`INSERT INTO global_customers (whatsapp, name, email, birth_date)
        VALUES (${data.whatsapp}, ${data.name}, ${data.email ?? null}, ${toDateColumn(data.birthDate)})
        RETURNING ${GLOBAL_COLUMNS}`
  );
  return toGlobal(rows<GlobalCustomerRow>(result)[0]);
}

// ---------------------------------------------------------------------------
// Clientes LOCAIS — isolados no schema do tenant (Regra #1)
// ---------------------------------------------------------------------------

export async function createCustomerInTenant(
  ctx: TenantContext,
  input: {
    globalCustomerId?: string;
    whatsapp: string;
    name: string;
    email?: string;
    birthDate?: Date;
    createdByUserId: string;
  }
): Promise<LocalCustomer> {
  assertSchema(ctx.schemaName);
  const result = await ctx.db.execute<LocalCustomerRow>(
    sql`INSERT INTO ${tenantTable(ctx.schemaName, "customers")}
          (global_customer_id, whatsapp, name, email, birth_date, created_by_user_id)
        VALUES (${input.globalCustomerId ?? null}, ${input.whatsapp}, ${input.name},
                ${input.email ?? null}, ${toDateColumn(input.birthDate)}, ${input.createdByUserId})
        RETURNING ${LOCAL_COLUMNS}`
  );
  return toLocal(rows<LocalCustomerRow>(result)[0]);
}

export async function getCustomerById(
  ctx: TenantContext,
  customerId: string
): Promise<LocalCustomer | null> {
  assertSchema(ctx.schemaName);
  const result = await ctx.db.execute<LocalCustomerRow>(
    sql`SELECT ${LOCAL_COLUMNS} FROM ${tenantTable(ctx.schemaName, "customers")} WHERE id = ${customerId} LIMIT 1`
  );
  const row = rows<LocalCustomerRow>(result)[0];
  return row ? toLocal(row) : null;
}

export async function searchCustomersForPdv(
  ctx: TenantContext,
  query: string
): Promise<LocalCustomer[]> {
  assertSchema(ctx.schemaName);
  if (!query || query.length < 2) return [];

  const where = query.startsWith("+")
    ? sql`whatsapp = ${query}`
    : sql`name ILIKE ${"%" + query + "%"}`;

  const result = await ctx.db.execute<LocalCustomerRow>(
    sql`SELECT ${LOCAL_COLUMNS} FROM ${tenantTable(ctx.schemaName, "customers")} WHERE ${where} LIMIT 10`
  );
  return rows<LocalCustomerRow>(result).map(toLocal);
}

export async function getCustomersByTenant(ctx: TenantContext): Promise<LocalCustomer[]> {
  assertSchema(ctx.schemaName);
  const result = await ctx.db.execute<LocalCustomerRow>(
    sql`SELECT ${LOCAL_COLUMNS} FROM ${tenantTable(ctx.schemaName, "customers")} ORDER BY name ASC`
  );
  return rows<LocalCustomerRow>(result).map(toLocal);
}

export async function updateCustomer(
  ctx: TenantContext,
  customerId: string,
  updates: Partial<Omit<LocalCustomer, "id" | "createdAt" | "createdByUserId">>
): Promise<void> {
  assertSchema(ctx.schemaName);

  const sets: ReturnType<typeof sql>[] = [];
  if (updates.globalCustomerId !== undefined) sets.push(sql`global_customer_id = ${updates.globalCustomerId}`);
  if (updates.whatsapp !== undefined) sets.push(sql`whatsapp = ${updates.whatsapp}`);
  if (updates.name !== undefined) sets.push(sql`name = ${updates.name}`);
  if (updates.email !== undefined) sets.push(sql`email = ${updates.email}`);
  if (updates.birthDate !== undefined) sets.push(sql`birth_date = ${updates.birthDate}`);
  if (updates.status !== undefined) sets.push(sql`status = ${updates.status}`);
  sets.push(sql`updated_at = now()`);

  await ctx.db.execute(
    sql`UPDATE ${tenantTable(ctx.schemaName, "customers")}
        SET ${sql.join(sets, sql`, `)}
        WHERE id = ${customerId}`
  );
}
