import { z } from "zod";
import { sql } from "drizzle-orm";
import { assertTenantId, rows, type ArenaDb, type TenantContext } from "../db/tenant";

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
  /** Coluna `date` do Postgres — string ISO (YYYY-MM-DD). */
  birthDate: string | null;
  photoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalCustomer {
  id: string;
  tenantId: string;
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
  tenant_id: string;
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

const GLOBAL_COLS = sql`id, whatsapp, name, email, birth_date, photo_url, created_at, updated_at`;
const LOCAL_COLS = sql`id, tenant_id, global_customer_id, whatsapp, name, email, birth_date, status, created_by_user_id, created_at, updated_at`;

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
    tenantId: row.tenant_id,
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

// --- Identidade GLOBAL (sem tenant) -----------------------------------------

export async function findOrCreateGlobalCustomer(
  db: ArenaDb,
  whatsapp: string
): Promise<{ found: boolean; customer: GlobalCustomer }> {
  const validated = WhatsappSchema.parse(whatsapp);
  const result = await db.execute<GlobalCustomerRow>(
    sql`SELECT ${GLOBAL_COLS} FROM global_customers WHERE whatsapp = ${validated} LIMIT 1`
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
        RETURNING ${GLOBAL_COLS}`
  );
  return toGlobal(rows<GlobalCustomerRow>(result)[0]);
}

// --- Clientes LOCAIS (escopo de arena) --------------------------------------

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
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<LocalCustomerRow>(
    sql`INSERT INTO customers
          (tenant_id, global_customer_id, whatsapp, name, email, birth_date, created_by_user_id)
        VALUES (${ctx.tenantId}, ${input.globalCustomerId ?? null}, ${input.whatsapp}, ${input.name},
                ${input.email ?? null}, ${toDateColumn(input.birthDate)}, ${input.createdByUserId})
        RETURNING ${LOCAL_COLS}`
  );
  return toLocal(rows<LocalCustomerRow>(result)[0]);
}

export async function getCustomerById(
  ctx: TenantContext,
  customerId: string
): Promise<LocalCustomer | null> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<LocalCustomerRow>(
    sql`SELECT ${LOCAL_COLS} FROM customers WHERE id = ${customerId} AND tenant_id = ${ctx.tenantId} LIMIT 1`
  );
  const row = rows<LocalCustomerRow>(result)[0];
  return row ? toLocal(row) : null;
}

export async function searchCustomersForPdv(
  ctx: TenantContext,
  query: string
): Promise<LocalCustomer[]> {
  assertTenantId(ctx.tenantId);
  const clean = query?.trim() ?? "";
  if (!clean || clean.length < 2) return [];

  const searchPattern = `%${clean}%`;

  const result = await ctx.db.execute<LocalCustomerRow>(
    sql`SELECT ${LOCAL_COLS} FROM customers
        WHERE tenant_id = ${ctx.tenantId}
          AND (name ILIKE ${searchPattern} OR whatsapp ILIKE ${searchPattern})
        ORDER BY name ASC
        LIMIT 10`
  );
  return rows<LocalCustomerRow>(result).map(toLocal);
}

export async function getCustomersByTenant(ctx: TenantContext): Promise<LocalCustomer[]> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<LocalCustomerRow>(
    sql`SELECT ${LOCAL_COLS} FROM customers WHERE tenant_id = ${ctx.tenantId} ORDER BY name ASC`
  );
  return rows<LocalCustomerRow>(result).map(toLocal);
}

export async function updateCustomer(
  ctx: TenantContext,
  customerId: string,
  updates: Partial<Omit<LocalCustomer, "id" | "tenantId" | "createdAt" | "createdByUserId">>
): Promise<void> {
  assertTenantId(ctx.tenantId);
  const sets: ReturnType<typeof sql>[] = [];
  if (updates.globalCustomerId !== undefined) sets.push(sql`global_customer_id = ${updates.globalCustomerId}`);
  if (updates.whatsapp !== undefined) sets.push(sql`whatsapp = ${updates.whatsapp}`);
  if (updates.name !== undefined) sets.push(sql`name = ${updates.name}`);
  if (updates.email !== undefined) sets.push(sql`email = ${updates.email}`);
  if (updates.birthDate !== undefined) sets.push(sql`birth_date = ${updates.birthDate}`);
  if (updates.status !== undefined) sets.push(sql`status = ${updates.status}`);
  sets.push(sql`updated_at = now()`);

  await ctx.db.execute(
    sql`UPDATE customers SET ${sql.join(sets, sql`, `)}
        WHERE id = ${customerId} AND tenant_id = ${ctx.tenantId}`
  );
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

// --- Opt-in LGPD (CAD-01) ----------------------------------------------------

export const SetCustomerOptInInputSchema = z.object({
  customerId: z.string().uuid(),
  optIn: z.boolean(),
});

/**
 * Grava/atualiza o consentimento de comunicação via WhatsApp (CAD-01, LGPD).
 * `ON CONFLICT` por `customer_id` (unique) — idempotente: chamar de novo com o
 * mesmo valor apenas atualiza `changed_at`.
 */
export async function setCustomerOptIn(
  ctx: TenantContext,
  input: z.infer<typeof SetCustomerOptInInputSchema>
): Promise<void> {
  assertTenantId(ctx.tenantId);
  const data = SetCustomerOptInInputSchema.parse(input);

  // Guarda IDOR (regra 1b): revalida que o customerId pertence a ESTE tenant
  // antes de gravar — customer_opt_in_lgpd.customer_id é único globalmente
  // (sem FK), então um id de outro tenant alteraria o opt-in de um cliente alheio.
  const customer = await getCustomerById(ctx, data.customerId);
  if (!customer) {
    throw new Error(`Cliente ${data.customerId} não encontrado neste tenant.`);
  }

  await ctx.db.execute(
    sql`INSERT INTO customer_opt_in_lgpd (tenant_id, customer_id, opt_in, opt_in_at, opt_out_at, changed_by_user_id)
        VALUES (${ctx.tenantId}, ${data.customerId}, ${data.optIn},
                ${data.optIn ? sql`now()` : null}, ${!data.optIn ? sql`now()` : null},
                ${ctx.actorUserId ?? null})
        ON CONFLICT (customer_id) DO UPDATE SET
          opt_in = EXCLUDED.opt_in,
          opt_in_at = CASE WHEN EXCLUDED.opt_in THEN now() ELSE customer_opt_in_lgpd.opt_in_at END,
          opt_out_at = CASE WHEN NOT EXCLUDED.opt_in THEN now() ELSE customer_opt_in_lgpd.opt_out_at END,
          changed_by_user_id = EXCLUDED.changed_by_user_id,
          changed_at = now()`
  );
  await writeAudit(ctx, "customer:opt_in_changed", { customerId: data.customerId, optIn: data.optIn });
}

// --- Cadastro rápido inline no PDV (PDV-02) ---------------------------------

export const QuickCreateCustomerInputSchema = z.object({
  whatsapp: WhatsappSchema,
  name: z.string().min(1, "Nome obrigatório").max(100),
  optInLgpd: z.boolean().default(false),
});

export type QuickCreateCustomerResult =
  | {
      success: true;
      customer: LocalCustomer;
      /** Já existia um cliente local no tenant com esse WhatsApp — nada foi criado. */
      reusedExistingLocal: boolean;
      /** O registro em `global_customers` já existia (de outra arena) e foi reaproveitado. */
      globalCustomerFound: boolean;
    }
  | { success: false; reason: "validation"; errors: Record<string, string[] | undefined> };

/**
 * Cadastro rápido de cliente direto na tela do PDV (PDV-02), sem sair para a
 * tela completa (CAD-01). Só Nome + WhatsApp são exigidos aqui — orquestra as
 * mesmas funções de identidade global do cadastro completo, não duplica lógica.
 */
export async function quickCreateCustomerForPdv(
  ctx: TenantContext,
  input: z.infer<typeof QuickCreateCustomerInputSchema>
): Promise<QuickCreateCustomerResult> {
  assertTenantId(ctx.tenantId);
  if (!ctx.actorUserId) {
    throw new Error("quickCreateCustomerForPdv exige ctx.actorUserId (operador do lançamento).");
  }

  const parsed = QuickCreateCustomerInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, reason: "validation", errors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  // Cliente já local no tenant com esse WhatsApp: reaproveita, não duplica.
  const existingLocal = await searchCustomersForPdv(ctx, data.whatsapp);
  const alreadyLocal = existingLocal.find((c) => c.whatsapp === data.whatsapp);
  if (alreadyLocal) {
    await setCustomerOptIn(ctx, { customerId: alreadyLocal.id, optIn: data.optInLgpd });
    return { success: true, customer: alreadyLocal, reusedExistingLocal: true, globalCustomerFound: false };
  }

  const globalResult = await findOrCreateGlobalCustomer(ctx.db, data.whatsapp);
  const globalCustomer = globalResult.found
    ? globalResult.customer
    : await createGlobalCustomer(ctx.db, { whatsapp: data.whatsapp, name: data.name });

  // Dados do global prevalecem quando já existia (evita divergir do que outra arena já viu).
  const local = await createCustomerInTenant(ctx, {
    globalCustomerId: globalCustomer.id,
    whatsapp: data.whatsapp,
    name: globalResult.found ? globalCustomer.name : data.name,
    email: globalResult.found && globalCustomer.email ? globalCustomer.email : undefined,
    birthDate: globalResult.found && globalCustomer.birthDate ? new Date(globalCustomer.birthDate) : undefined,
    createdByUserId: ctx.actorUserId,
  });

  await setCustomerOptIn(ctx, { customerId: local.id, optIn: data.optInLgpd });
  await writeAudit(ctx, "customer:quick_created_via_pdv", {
    customerId: local.id,
    globalCustomerFound: globalResult.found,
  });

  return { success: true, customer: local, reusedExistingLocal: false, globalCustomerFound: globalResult.found };
}
