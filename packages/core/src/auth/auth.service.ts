import { hash, verify } from "@node-rs/argon2";
import { randomBytes } from "crypto";
import { sql } from "drizzle-orm";
import { assertTenantId, rows, type ArenaDb } from "../db/tenant";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;
const ACTIVATION_TOKEN_EXPIRY_HOURS = 48;
const RESET_TOKEN_EXPIRY_HOURS = 24;

/** Conexão Drizzle compartilhada. */
export type AuthDb = ArenaDb;

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
};

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
 * Valida credenciais de um operador da arena. O `identifier` pode ser username
 * ou e-mail; o `tenantId` (UUID) já foi resolvido pelo subdomínio (SAAS-03).
 * Row-level: filtra `tenant_id` em toda query (ver Regra inviolável #1).
 */
export async function validateCredentials(
  identifier: string,
  password: string,
  tenantId: string,
  db: AuthDb
): Promise<ValidateCredentialsResult> {
  assertTenantId(tenantId);
  const id = identifier.trim().toLowerCase();
  const byEmail = id.includes("@");

  const result = await db.execute<AuthUserRow>(
    sql`SELECT id, username, email, password_hash, role, modules_allowed, status,
               must_change_password, activated_at, activation_token_expires_at,
               reset_token_expires_at, failed_attempts, locked_until
        FROM users_tenants
        WHERE tenant_id = ${tenantId}
          AND ${byEmail ? sql`email = ${id}` : sql`username = ${id}`}
        LIMIT 1`
  );
  const user = rows<AuthUserRow>(result)[0];

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
      sql`UPDATE users_tenants
          SET failed_attempts = ${newFailedAttempts}, locked_until = ${lockedUntil}, updated_at = now()
          WHERE id = ${user.id} AND tenant_id = ${tenantId}`
    );
    return { success: false, reason: shouldLock ? "account_locked" : "invalid_credentials" };
  }

  await db.execute(
    sql`UPDATE users_tenants
        SET failed_attempts = 0, locked_until = NULL, last_login_at = now(), updated_at = now()
        WHERE id = ${user.id} AND tenant_id = ${tenantId}`
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
// Ativação de conta (operadores COM e-mail)
// ---------------------------------------------------------------------------

export async function createActivationToken(
  userId: string,
  tenantId: string,
  db: AuthDb
): Promise<string> {
  assertTenantId(tenantId);
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ACTIVATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
  await db.execute(
    sql`UPDATE users_tenants
        SET activation_token = ${token}, activation_token_expires_at = ${expiresAt}, updated_at = now()
        WHERE id = ${userId} AND tenant_id = ${tenantId}`
  );
  return token;
}

export async function activateAccount(
  token: string,
  newPassword: string,
  tenantId: string,
  db: AuthDb
): Promise<TokenOperationResult> {
  assertTenantId(tenantId);
  if (!isPasswordAcceptable(newPassword)) {
    return { success: false, reason: "weak_password" };
  }
  const found = await db.execute<{ id: string; activation_token_expires_at: Date | null }>(
    sql`SELECT id, activation_token_expires_at FROM users_tenants
        WHERE tenant_id = ${tenantId} AND activation_token = ${token} LIMIT 1`
  );
  const user = rows<{ id: string; activation_token_expires_at: Date | null }>(found)[0];
  if (!user) return { success: false, reason: "token_not_found" };
  if (!user.activation_token_expires_at || new Date(user.activation_token_expires_at) <= new Date()) {
    return { success: false, reason: "token_expired" };
  }
  const passwordHash = await hash(newPassword);
  await db.execute(
    sql`UPDATE users_tenants
        SET password_hash = ${passwordHash}, activated_at = now(),
            activation_token = NULL, activation_token_expires_at = NULL, updated_at = now()
        WHERE id = ${user.id} AND tenant_id = ${tenantId}`
  );
  return { success: true };
}

// ---------------------------------------------------------------------------
// Recuperação de senha por e-mail
// ---------------------------------------------------------------------------

export async function createPasswordResetToken(
  email: string,
  tenantId: string,
  db: AuthDb
): Promise<string | null> {
  assertTenantId(tenantId);
  const found = await db.execute<{ id: string }>(
    sql`SELECT id FROM users_tenants
        WHERE tenant_id = ${tenantId} AND email = ${email.trim().toLowerCase()} LIMIT 1`
  );
  const user = rows<{ id: string }>(found)[0];
  if (!user) return null;

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
  await db.execute(
    sql`UPDATE users_tenants
        SET reset_token = ${token}, reset_token_expires_at = ${expiresAt}, updated_at = now()
        WHERE id = ${user.id} AND tenant_id = ${tenantId}`
  );
  return token;
}

export async function resetPassword(
  token: string,
  newPassword: string,
  tenantId: string,
  db: AuthDb
): Promise<TokenOperationResult> {
  assertTenantId(tenantId);
  if (!isPasswordAcceptable(newPassword)) {
    return { success: false, reason: "weak_password" };
  }
  const found = await db.execute<{ id: string; reset_token_expires_at: Date | null }>(
    sql`SELECT id, reset_token_expires_at FROM users_tenants
        WHERE tenant_id = ${tenantId} AND reset_token = ${token} LIMIT 1`
  );
  const user = rows<{ id: string; reset_token_expires_at: Date | null }>(found)[0];
  if (!user) return { success: false, reason: "token_not_found" };
  if (!user.reset_token_expires_at || new Date(user.reset_token_expires_at) <= new Date()) {
    return { success: false, reason: "token_expired" };
  }
  const passwordHash = await hash(newPassword);
  await db.execute(
    sql`UPDATE users_tenants
        SET password_hash = ${passwordHash}, reset_token = NULL, reset_token_expires_at = NULL,
            failed_attempts = 0, locked_until = NULL, updated_at = now()
        WHERE id = ${user.id} AND tenant_id = ${tenantId}`
  );
  return { success: true };
}
