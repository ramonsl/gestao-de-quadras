import { hash } from "@node-rs/argon2";
import { sql, type SQL } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { z } from "zod";
import type * as schema from "@gestao-de-quadras/db/schema";
import { MODULES } from "./modules";

// ---------------------------------------------------------------------------
// Tipos e contexto
// ---------------------------------------------------------------------------

export type ArenaDb = NeonHttpDatabase<typeof schema>;

export interface ArenaUserContext {
  db: ArenaDb;
  /** Nome físico do schema do tenant, ex.: `tenant_arena-x` */
  schemaName: string;
  /** users_tenants.id do Admin que executa a ação (para auditoria) */
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
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

/** Mínimo de 8 caracteres — unificado com os fluxos de ativação/reset (SAAS-03) */
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
    // Limite superior evita DoS no argon2 com payload gigante
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

// ---------------------------------------------------------------------------
// Resultados
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers internos (sempre parametrizados — nunca sql.raw com interpolação)
// ---------------------------------------------------------------------------

const SCHEMA_PATTERN = /^tenant_[a-z0-9-]+$/;

function assertSchema(schemaName: string): void {
  if (!SCHEMA_PATTERN.test(schemaName)) {
    throw new Error(`Nome de schema de tenant inválido: "${schemaName}".`);
  }
}

function usersTable(schemaName: string): SQL {
  return sql`${sql.identifier(schemaName)}.${sql.identifier("users_tenants")}`;
}

function auditTable(schemaName: string): SQL {
  return sql`${sql.identifier(schemaName)}.${sql.identifier("audit_logs")}`;
}

async function fetchUser(ctx: ArenaUserContext, userId: string): Promise<UserRow | null> {
  const result = await ctx.db.execute<UserRow>(
    sql`SELECT id, username, name, email, phone, role, modules_allowed, status, must_change_password, last_login_at
        FROM ${usersTable(ctx.schemaName)} WHERE id = ${userId} LIMIT 1`
  );
  return (result.rows as unknown as UserRow[])[0] ?? null;
}

async function countActiveAdmins(ctx: ArenaUserContext, excludeUserId?: string): Promise<number> {
  const result = await ctx.db.execute<{ count: number }>(
    sql`SELECT COUNT(*)::int AS count FROM ${usersTable(ctx.schemaName)}
        WHERE role = 'admin' AND status = 'active'
        ${excludeUserId ? sql`AND id <> ${excludeUserId}` : sql``}`
  );
  return (result.rows as unknown as Array<{ count: number }>)[0]?.count ?? 0;
}

async function writeAudit(
  ctx: ArenaUserContext,
  action: string,
  details: Record<string, unknown>
): Promise<void> {
  await ctx.db.execute(
    sql`INSERT INTO ${auditTable(ctx.schemaName)} (user_id, action, details)
        VALUES (${ctx.actorUserId}, ${action}, ${JSON.stringify(details)})`
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

/** Lista os operadores do tenant. */
export async function listArenaUsers(ctx: ArenaUserContext): Promise<ArenaUserListItem[]> {
  assertSchema(ctx.schemaName);
  const result = await ctx.db.execute<UserRow>(
    sql`SELECT id, username, name, email, phone, role, modules_allowed, status, must_change_password, last_login_at
        FROM ${usersTable(ctx.schemaName)} ORDER BY name ASC`
  );
  return (result.rows as unknown as UserRow[]).map(toListItem);
}

/** Busca um operador do tenant pelo id (para o formulário de edição). */
export async function getArenaUser(ctx: ArenaUserContext, userId: string): Promise<ArenaUserListItem | null> {
  assertSchema(ctx.schemaName);
  const row = await fetchUser(ctx, userId);
  return row ? toListItem(row) : null;
}

/**
 * Cria um operador da arena. A senha é definida pelo Admin no cadastro e a
 * conta já nasce ativa (operador sem e-mail loga imediatamente).
 */
export async function createArenaUser(
  input: CreateArenaUserInput,
  ctx: ArenaUserContext
): Promise<CreateArenaUserResult> {
  assertSchema(ctx.schemaName);

  const parsed = createArenaUserSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, reason: "validation", errors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  // Unicidade do username no tenant
  const existing = await ctx.db.execute<{ id: string }>(
    sql`SELECT id FROM ${usersTable(ctx.schemaName)} WHERE username = ${data.username} LIMIT 1`
  );
  if ((existing.rows as unknown as unknown[]).length > 0) {
    return { success: false, reason: "username_taken" };
  }

  // Unicidade do e-mail no tenant (quando informado)
  if (data.email) {
    const emailRow = await ctx.db.execute<{ id: string }>(
      sql`SELECT id FROM ${usersTable(ctx.schemaName)} WHERE email = ${data.email} LIMIT 1`
    );
    if ((emailRow.rows as unknown as unknown[]).length > 0) {
      return { success: false, reason: "email_taken" };
    }
  }

  const passwordHash = await hash(data.password);
  // Admin é irrestrito por definição (AC5) — não depende da seleção da UI
  const modules = data.role === "admin" ? [...MODULES] : data.modulesAllowed;
  const modulesJson = JSON.stringify(modules);

  const inserted = await ctx.db.execute<{ id: string }>(
    sql`INSERT INTO ${usersTable(ctx.schemaName)}
        (username, name, email, phone, password_hash, role, modules_allowed, status, must_change_password, activated_at)
        VALUES (${data.username}, ${data.name}, ${data.email ?? null}, ${data.phone ?? null}, ${passwordHash},
                ${data.role}, ${modulesJson}, 'active', ${data.mustChangePassword}, now())
        RETURNING id`
  );
  const userId = (inserted.rows as unknown as Array<{ id: string }>)[0].id;

  await writeAudit(ctx, "user.created", {
    targetUserId: userId,
    username: data.username,
    role: data.role,
    modulesAllowed: modules,
  });

  return { success: true, userId };
}

/** Atualiza dados, perfil e módulos de um operador. */
export async function updateArenaUser(
  userId: string,
  input: UpdateArenaUserInput,
  ctx: ArenaUserContext
): Promise<UpdateArenaUserResult> {
  assertSchema(ctx.schemaName);

  const parsed = updateArenaUserSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, reason: "validation", errors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const current = await fetchUser(ctx, userId);
  if (!current) {
    return { success: false, reason: "not_found" };
  }

  // Rebaixar o último Admin ativo é proibido (autoproteção)
  const demotingAdmin = current.role === "admin" && data.role !== "admin" && current.status === "active";
  if (demotingAdmin && (await countActiveAdmins(ctx, userId)) === 0) {
    return { success: false, reason: "last_active_admin" };
  }

  // Unicidade de e-mail (quando alterado)
  if (data.email && data.email !== current.email) {
    const emailRow = await ctx.db.execute<{ id: string }>(
      sql`SELECT id FROM ${usersTable(ctx.schemaName)} WHERE email = ${data.email} AND id <> ${userId} LIMIT 1`
    );
    if ((emailRow.rows as unknown as unknown[]).length > 0) {
      return { success: false, reason: "email_taken" };
    }
  }

  // Admin é irrestrito por definição (AC5)
  const modules = data.role === "admin" ? [...MODULES] : data.modulesAllowed;
  const modulesJson = JSON.stringify(modules);
  await ctx.db.execute(
    sql`UPDATE ${usersTable(ctx.schemaName)}
        SET name = ${data.name}, email = ${data.email ?? null}, phone = ${data.phone ?? null},
            role = ${data.role}, modules_allowed = ${modulesJson}, must_change_password = ${data.mustChangePassword},
            updated_at = now()
        WHERE id = ${userId}`
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

/** Inativa um operador (bloqueia login imediatamente, preserva histórico). */
export async function deactivateArenaUser(userId: string, ctx: ArenaUserContext): Promise<MutateResult> {
  assertSchema(ctx.schemaName);

  const current = await fetchUser(ctx, userId);
  if (!current) return { success: false, reason: "not_found" };
  if (current.status === "inactive") return { success: true };

  // A arena deve manter ao menos um Admin ativo
  if (current.role === "admin" && (await countActiveAdmins(ctx, userId)) === 0) {
    return { success: false, reason: "last_active_admin" };
  }

  await ctx.db.execute(
    sql`UPDATE ${usersTable(ctx.schemaName)} SET status = 'inactive', updated_at = now() WHERE id = ${userId}`
  );
  await writeAudit(ctx, "user.deactivated", { targetUserId: userId });
  return { success: true };
}

/** Reativa um operador previamente inativado. */
export async function reactivateArenaUser(userId: string, ctx: ArenaUserContext): Promise<MutateResult> {
  assertSchema(ctx.schemaName);

  const current = await fetchUser(ctx, userId);
  if (!current) return { success: false, reason: "not_found" };
  if (current.status === "active") return { success: true };

  await ctx.db.execute(
    sql`UPDATE ${usersTable(ctx.schemaName)} SET status = 'active', updated_at = now() WHERE id = ${userId}`
  );
  await writeAudit(ctx, "user.reactivated", { targetUserId: userId });
  return { success: true };
}

/**
 * Redefine a senha de um operador (feito pelo Admin — recuperação para quem não
 * tem e-mail). Zera lockout/tentativas e pode forçar troca no próximo login.
 */
export async function resetArenaUserPassword(
  userId: string,
  newPassword: string,
  ctx: ArenaUserContext,
  options: { mustChangePassword?: boolean } = {}
): Promise<ResetPasswordResult> {
  assertSchema(ctx.schemaName);

  if (!newPassword || newPassword.length < PASSWORD_MIN_LENGTH || newPassword.length > 128) {
    return { success: false, reason: "weak_password" };
  }

  const current = await fetchUser(ctx, userId);
  if (!current) return { success: false, reason: "not_found" };

  const passwordHash = await hash(newPassword);
  await ctx.db.execute(
    sql`UPDATE ${usersTable(ctx.schemaName)}
        SET password_hash = ${passwordHash}, must_change_password = ${options.mustChangePassword ?? false},
            failed_attempts = 0, locked_until = NULL, activated_at = COALESCE(activated_at, now()), updated_at = now()
        WHERE id = ${userId}`
  );
  // details nunca contém o hash nem a senha
  await writeAudit(ctx, "user.password_reset", { targetUserId: userId });
  return { success: true };
}
