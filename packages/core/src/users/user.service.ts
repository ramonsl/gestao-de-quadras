import { hash } from "@node-rs/argon2";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { assertTenantId, rows, type ArenaDb } from "../db/tenant";
import { MODULES } from "./modules";

// ---------------------------------------------------------------------------
// Contexto (row-level: tenant_id)
// ---------------------------------------------------------------------------

export interface ArenaUserContext {
  db: ArenaDb;
  /** UUID da arena (public.tenants.id). */
  tenantId: string;
  /** users_tenants.id do Admin que executa a ação (auditoria). */
  actorUserId: string;
}

export interface ArenaUserListItem {
  id: string;
  name: string;
  username: string;
  email: string | null;
  phone: string | null;
  role: "admin" | "gerente" | "atendente";
  modulesAllowed: string[];
  status: "active" | "inactive";
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
}

type UserRow = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: "admin" | "gerente" | "atendente";
  modules_allowed: string;
  status: "active" | "inactive";
  must_change_password: boolean;
  last_login_at: Date | null;
};

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

export const PASSWORD_MIN_LENGTH = 8;

const roleSchema = z.enum(["admin", "gerente", "atendente"]);
const moduleSchema = z.enum(MODULES);

export const createArenaUserSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(120, "Nome muito longo."),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "O usuário deve ter ao menos 3 caracteres.")
    .max(50)
    .regex(/^[a-z0-9._-]+$/, "Use apenas letras minúsculas, números, ponto, hífen ou underscore."),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `A senha deve ter ao menos ${PASSWORD_MIN_LENGTH} caracteres.`)
    .max(128, "Senha muito longa."),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().trim().max(20).optional().or(z.literal("").transform(() => undefined)),
  role: roleSchema,
  modulesAllowed: z.array(moduleSchema).default([]),
  mustChangePassword: z.boolean().default(false),
});

export const updateArenaUserSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(120, "Nome muito longo."),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().trim().max(20).optional().or(z.literal("").transform(() => undefined)),
  role: roleSchema,
  modulesAllowed: z.array(moduleSchema).default([]),
  mustChangePassword: z.boolean().default(false),
});

export type CreateArenaUserInput = z.infer<typeof createArenaUserSchema>;
export type UpdateArenaUserInput = z.infer<typeof updateArenaUserSchema>;

export type CreateArenaUserResult =
  | { success: true; userId: string }
  | { success: false; reason: "username_taken" | "email_taken" | "validation"; errors?: Record<string, string[]> };

export type UpdateArenaUserResult =
  | { success: true }
  | { success: false; reason: "not_found" | "email_taken" | "last_active_admin" | "validation"; errors?: Record<string, string[]> };

export type MutateResult =
  | { success: true }
  | { success: false; reason: "not_found" | "last_active_admin" };

export type ResetPasswordResult =
  | { success: true }
  | { success: false; reason: "not_found" | "weak_password" };

const USER_COLUMNS = sql`id, username, name, email, phone, role, modules_allowed, status, must_change_password, last_login_at`;

// ---------------------------------------------------------------------------
// Helpers internos (sempre filtrando tenant_id)
// ---------------------------------------------------------------------------

async function fetchUser(ctx: ArenaUserContext, userId: string): Promise<UserRow | null> {
  const result = await ctx.db.execute<UserRow>(
    sql`SELECT ${USER_COLUMNS} FROM users_tenants
        WHERE id = ${userId} AND tenant_id = ${ctx.tenantId} LIMIT 1`
  );
  return rows<UserRow>(result)[0] ?? null;
}

async function countActiveAdmins(ctx: ArenaUserContext, excludeUserId?: string): Promise<number> {
  const result = await ctx.db.execute<{ count: number }>(
    sql`SELECT COUNT(*)::int AS count FROM users_tenants
        WHERE tenant_id = ${ctx.tenantId} AND role = 'admin' AND status = 'active'
        ${excludeUserId ? sql`AND id <> ${excludeUserId}` : sql``}`
  );
  return rows<{ count: number }>(result)[0]?.count ?? 0;
}

async function writeAudit(
  ctx: ArenaUserContext,
  action: string,
  details: Record<string, unknown>
): Promise<void> {
  await ctx.db.execute(
    sql`INSERT INTO audit_logs (tenant_id, user_id, action, details)
        VALUES (${ctx.tenantId}, ${ctx.actorUserId}, ${action}, ${JSON.stringify(details)})`
  );
}

function toListItem(row: UserRow): ArenaUserListItem {
  let modulesAllowed: string[] = [];
  try {
    modulesAllowed = JSON.parse(row.modules_allowed || "[]");
  } catch {
    modulesAllowed = [];
  }
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    email: row.email,
    phone: row.phone,
    role: row.role,
    modulesAllowed,
    status: row.status,
    mustChangePassword: row.must_change_password,
    lastLoginAt: row.last_login_at,
  };
}

// ---------------------------------------------------------------------------
// Operações (SAAS-12)
// ---------------------------------------------------------------------------

export async function listArenaUsers(ctx: ArenaUserContext): Promise<ArenaUserListItem[]> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<UserRow>(
    sql`SELECT ${USER_COLUMNS} FROM users_tenants
        WHERE tenant_id = ${ctx.tenantId} ORDER BY name ASC`
  );
  return rows<UserRow>(result).map(toListItem);
}

export async function getArenaUser(ctx: ArenaUserContext, userId: string): Promise<ArenaUserListItem | null> {
  assertTenantId(ctx.tenantId);
  const row = await fetchUser(ctx, userId);
  return row ? toListItem(row) : null;
}

export async function createArenaUser(
  input: CreateArenaUserInput,
  ctx: ArenaUserContext
): Promise<CreateArenaUserResult> {
  assertTenantId(ctx.tenantId);

  const parsed = createArenaUserSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, reason: "validation", errors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const existing = await ctx.db.execute<{ id: string }>(
    sql`SELECT id FROM users_tenants WHERE tenant_id = ${ctx.tenantId} AND username = ${data.username} LIMIT 1`
  );
  if (rows<{ id: string }>(existing).length > 0) {
    return { success: false, reason: "username_taken" };
  }

  if (data.email) {
    const emailRow = await ctx.db.execute<{ id: string }>(
      sql`SELECT id FROM users_tenants WHERE tenant_id = ${ctx.tenantId} AND email = ${data.email} LIMIT 1`
    );
    if (rows<{ id: string }>(emailRow).length > 0) {
      return { success: false, reason: "email_taken" };
    }
  }

  const passwordHash = await hash(data.password);
  const modules = data.role === "admin" ? [...MODULES] : data.modulesAllowed;
  const modulesJson = JSON.stringify(modules);

  const inserted = await ctx.db.execute<{ id: string }>(
    sql`INSERT INTO users_tenants
          (tenant_id, username, name, email, phone, password_hash, role, modules_allowed, status, must_change_password, activated_at)
        VALUES (${ctx.tenantId}, ${data.username}, ${data.name}, ${data.email ?? null}, ${data.phone ?? null},
                ${passwordHash}, ${data.role}, ${modulesJson}, 'active', ${data.mustChangePassword}, now())
        RETURNING id`
  );
  const userId = rows<{ id: string }>(inserted)[0].id;

  await writeAudit(ctx, "user.created", {
    targetUserId: userId,
    username: data.username,
    role: data.role,
    modulesAllowed: modules,
  });

  return { success: true, userId };
}

export async function updateArenaUser(
  userId: string,
  input: UpdateArenaUserInput,
  ctx: ArenaUserContext
): Promise<UpdateArenaUserResult> {
  assertTenantId(ctx.tenantId);

  const parsed = updateArenaUserSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, reason: "validation", errors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const current = await fetchUser(ctx, userId);
  if (!current) {
    return { success: false, reason: "not_found" };
  }

  const demotingAdmin = current.role === "admin" && data.role !== "admin" && current.status === "active";
  if (demotingAdmin && (await countActiveAdmins(ctx, userId)) === 0) {
    return { success: false, reason: "last_active_admin" };
  }

  if (data.email && data.email !== current.email) {
    const emailRow = await ctx.db.execute<{ id: string }>(
      sql`SELECT id FROM users_tenants
          WHERE tenant_id = ${ctx.tenantId} AND email = ${data.email} AND id <> ${userId} LIMIT 1`
    );
    if (rows<{ id: string }>(emailRow).length > 0) {
      return { success: false, reason: "email_taken" };
    }
  }

  const modules = data.role === "admin" ? [...MODULES] : data.modulesAllowed;
  const modulesJson = JSON.stringify(modules);
  await ctx.db.execute(
    sql`UPDATE users_tenants
        SET name = ${data.name}, email = ${data.email ?? null}, phone = ${data.phone ?? null},
            role = ${data.role}, modules_allowed = ${modulesJson}, must_change_password = ${data.mustChangePassword},
            updated_at = now()
        WHERE id = ${userId} AND tenant_id = ${ctx.tenantId}`
  );

  const currentModules = (() => {
    try {
      return JSON.parse(current.modules_allowed || "[]") as string[];
    } catch {
      return [];
    }
  })();
  const modulesChanged = JSON.stringify(currentModules) !== modulesJson;

  await writeAudit(ctx, modulesChanged ? "user.modules_changed" : "user.updated", {
    targetUserId: userId,
    before: { role: current.role, modulesAllowed: currentModules },
    after: { role: data.role, modulesAllowed: modules },
  });

  return { success: true };
}

export async function deactivateArenaUser(userId: string, ctx: ArenaUserContext): Promise<MutateResult> {
  assertTenantId(ctx.tenantId);

  const current = await fetchUser(ctx, userId);
  if (!current) return { success: false, reason: "not_found" };
  if (current.status === "inactive") return { success: true };

  if (current.role === "admin" && (await countActiveAdmins(ctx, userId)) === 0) {
    return { success: false, reason: "last_active_admin" };
  }

  await ctx.db.execute(
    sql`UPDATE users_tenants SET status = 'inactive', updated_at = now()
        WHERE id = ${userId} AND tenant_id = ${ctx.tenantId}`
  );
  await writeAudit(ctx, "user.deactivated", { targetUserId: userId });
  return { success: true };
}

export async function reactivateArenaUser(userId: string, ctx: ArenaUserContext): Promise<MutateResult> {
  assertTenantId(ctx.tenantId);

  const current = await fetchUser(ctx, userId);
  if (!current) return { success: false, reason: "not_found" };
  if (current.status === "active") return { success: true };

  await ctx.db.execute(
    sql`UPDATE users_tenants SET status = 'active', updated_at = now()
        WHERE id = ${userId} AND tenant_id = ${ctx.tenantId}`
  );
  await writeAudit(ctx, "user.reactivated", { targetUserId: userId });
  return { success: true };
}

export async function resetArenaUserPassword(
  userId: string,
  newPassword: string,
  ctx: ArenaUserContext,
  options: { mustChangePassword?: boolean } = {}
): Promise<ResetPasswordResult> {
  assertTenantId(ctx.tenantId);

  if (!newPassword || newPassword.length < PASSWORD_MIN_LENGTH || newPassword.length > 128) {
    return { success: false, reason: "weak_password" };
  }

  const current = await fetchUser(ctx, userId);
  if (!current) return { success: false, reason: "not_found" };

  const passwordHash = await hash(newPassword);
  await ctx.db.execute(
    sql`UPDATE users_tenants
        SET password_hash = ${passwordHash}, must_change_password = ${options.mustChangePassword ?? false},
            failed_attempts = 0, locked_until = NULL, activated_at = COALESCE(activated_at, now()), updated_at = now()
        WHERE id = ${userId} AND tenant_id = ${ctx.tenantId}`
  );
  await writeAudit(ctx, "user.password_reset", { targetUserId: userId });
  return { success: true };
}
