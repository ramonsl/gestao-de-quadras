import { hash, verify } from "@node-rs/argon2";
import { randomBytes } from "crypto";
import { sql, type SQL } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type * as schema from "@gestao-de-quadras/db/schema";

// ---------------------------------------------------------------------------
// Constantes de segurança
// ---------------------------------------------------------------------------

/** Número máximo de tentativas antes do bloqueio */
const MAX_FAILED_ATTEMPTS = 5;

/** Duração do bloqueio em minutos */
const LOCK_DURATION_MINUTES = 15;

/** Expiração do token de ativação em horas */
const ACTIVATION_TOKEN_EXPIRY_HOURS = 48;

/** Expiração do token de recuperação de senha em horas */
const RESET_TOKEN_EXPIRY_HOURS = 24;

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type AuthDb = NeonHttpDatabase<typeof schema>;

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: "admin" | "gerente" | "atendente";
  modulesAllowed: string[];
  mustChangePassword: boolean;
}

export type ValidateCredentialsResult =
  | { success: true; user: AuthenticatedUser }
  | { success: false; reason: "invalid_credentials" | "account_locked" | "account_inactive" | "not_activated" };

export type TokenOperationResult =
  | { success: true }
  | { success: false; reason: "token_not_found" | "token_expired" | "weak_password" };

/** Mínimo de senha aplicado no core — a borda não é a única defesa. */
export const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

function isPasswordAcceptable(password: string): boolean {
  return (
    typeof password === "string" &&
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH
  );
}

type AuthUserRow = {
  id: string;
  username: string;
  email: string | null;
  password_hash: string | null;
  role: "admin" | "gerente" | "atendente";
  modules_allowed: string;
  status: "active" | "inactive";
  must_change_password: boolean;
  activated_at: Date | null;
  activation_token_expires_at: Date | null;
  reset_token_expires_at: Date | null;
  failed_attempts: number;
  locked_until: Date | null;
}

// ---------------------------------------------------------------------------
// Helpers — operadores vivem no schema do tenant (SAAS-12)
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

function parseModules(raw: string): string[] {
  try {
    return JSON.parse(raw || "[]");
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Autenticação (login por username OU e-mail dentro do tenant)
// ---------------------------------------------------------------------------

/**
 * Valida credenciais de um operador no schema do tenant. O `identifier` pode ser
 * o `username` ou o `email`; o tenant já foi resolvido pelo subdomínio (SAAS-03).
 * Gerencia contador de tentativas e bloqueio temporário.
 */
export async function validateCredentials(
  identifier: string,
  password: string,
  schemaName: string,
  db: AuthDb
): Promise<ValidateCredentialsResult> {
  assertSchema(schemaName);

  const id = identifier.trim().toLowerCase();
  const byEmail = id.includes("@");

  const result = await db.execute<AuthUserRow>(
    sql`SELECT id, username, email, password_hash, role, modules_allowed, status,
               must_change_password, activated_at, activation_token_expires_at,
               reset_token_expires_at, failed_attempts, locked_until
        FROM ${usersTable(schemaName)}
        WHERE ${byEmail ? sql`email = ${id}` : sql`username = ${id}`}
        LIMIT 1`
  );
  const user = (result.rows as unknown as AuthUserRow[])[0];

  if (!user || !user.password_hash) {
    return { success: false, reason: "invalid_credentials" };
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return { success: false, reason: "account_locked" };
  }

  if (user.status !== "active") {
    return { success: false, reason: "account_inactive" };
  }

  if (!user.activated_at) {
    return { success: false, reason: "not_activated" };
  }

  const passwordValid = await verify(user.password_hash, password);

  if (!passwordValid) {
    const newFailedAttempts = user.failed_attempts + 1;
    const shouldLock = newFailedAttempts >= MAX_FAILED_ATTEMPTS;
    const lockedUntil = shouldLock ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000) : null;

    await db.execute(
      sql`UPDATE ${usersTable(schemaName)}
          SET failed_attempts = ${newFailedAttempts}, locked_until = ${lockedUntil}, updated_at = now()
          WHERE id = ${user.id}`
    );

    return { success: false, reason: shouldLock ? "account_locked" : "invalid_credentials" };
  }

  // Login bem-sucedido: zera contador e registra último acesso
  await db.execute(
    sql`UPDATE ${usersTable(schemaName)}
        SET failed_attempts = 0, locked_until = NULL, last_login_at = now(), updated_at = now()
        WHERE id = ${user.id}`
  );

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      modulesAllowed: parseModules(user.modules_allowed),
      mustChangePassword: user.must_change_password,
    },
  };
}

// ---------------------------------------------------------------------------
// Ativação de conta (fluxo por e-mail — operadores COM e-mail)
// ---------------------------------------------------------------------------

/** Gera e persiste um token de ativação de conta. Retorna o token gerado. */
export async function createActivationToken(
  userId: string,
  schemaName: string,
  db: AuthDb
): Promise<string> {
  assertSchema(schemaName);

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ACTIVATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await db.execute(
    sql`UPDATE ${usersTable(schemaName)}
        SET activation_token = ${token}, activation_token_expires_at = ${expiresAt}, updated_at = now()
        WHERE id = ${userId}`
  );

  return token;
}

/** Ativa a conta definindo a senha inicial. Invalida o token após uso. */
export async function activateAccount(
  token: string,
  newPassword: string,
  schemaName: string,
  db: AuthDb
): Promise<TokenOperationResult> {
  assertSchema(schemaName);

  if (!isPasswordAcceptable(newPassword)) {
    return { success: false, reason: "weak_password" };
  }

  const now = new Date();
  const found = await db.execute<AuthUserRow>(
    sql`SELECT id, activation_token_expires_at FROM ${usersTable(schemaName)}
        WHERE activation_token = ${token} LIMIT 1`
  );
  const user = (found.rows as unknown as Array<{ id: string; activation_token_expires_at: Date | null }>)[0];

  if (!user) {
    return { success: false, reason: "token_not_found" };
  }
  if (!user.activation_token_expires_at || new Date(user.activation_token_expires_at) <= now) {
    return { success: false, reason: "token_expired" };
  }

  const passwordHash = await hash(newPassword);
  await db.execute(
    sql`UPDATE ${usersTable(schemaName)}
        SET password_hash = ${passwordHash}, activated_at = now(),
            activation_token = NULL, activation_token_expires_at = NULL, updated_at = now()
        WHERE id = ${user.id}`
  );

  return { success: true };
}

// ---------------------------------------------------------------------------
// Recuperação de senha por e-mail (operadores COM e-mail)
// ---------------------------------------------------------------------------

/**
 * Cria token de recuperação de senha. Retorna o token ou null se o e-mail não
 * existir no tenant (nunca revelar ao usuário se o e-mail existe).
 */
export async function createPasswordResetToken(
  email: string,
  schemaName: string,
  db: AuthDb
): Promise<string | null> {
  assertSchema(schemaName);

  const found = await db.execute<{ id: string }>(
    sql`SELECT id FROM ${usersTable(schemaName)} WHERE email = ${email.trim().toLowerCase()} LIMIT 1`
  );
  const user = (found.rows as unknown as Array<{ id: string }>)[0];
  if (!user) return null;

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await db.execute(
    sql`UPDATE ${usersTable(schemaName)}
        SET reset_token = ${token}, reset_token_expires_at = ${expiresAt}, updated_at = now()
        WHERE id = ${user.id}`
  );

  return token;
}

/** Redefine a senha usando o token de recuperação. Invalida o token após uso. */
export async function resetPassword(
  token: string,
  newPassword: string,
  schemaName: string,
  db: AuthDb
): Promise<TokenOperationResult> {
  assertSchema(schemaName);

  if (!isPasswordAcceptable(newPassword)) {
    return { success: false, reason: "weak_password" };
  }

  const now = new Date();
  const found = await db.execute<{ id: string; reset_token_expires_at: Date | null }>(
    sql`SELECT id, reset_token_expires_at FROM ${usersTable(schemaName)}
        WHERE reset_token = ${token} LIMIT 1`
  );
  const user = (found.rows as unknown as Array<{ id: string; reset_token_expires_at: Date | null }>)[0];

  if (!user) {
    return { success: false, reason: "token_not_found" };
  }
  if (!user.reset_token_expires_at || new Date(user.reset_token_expires_at) <= now) {
    return { success: false, reason: "token_expired" };
  }

  const passwordHash = await hash(newPassword);
  await db.execute(
    sql`UPDATE ${usersTable(schemaName)}
        SET password_hash = ${passwordHash}, reset_token = NULL, reset_token_expires_at = NULL,
            failed_attempts = 0, locked_until = NULL, updated_at = now()
        WHERE id = ${user.id}`
  );

  return { success: true };
}
