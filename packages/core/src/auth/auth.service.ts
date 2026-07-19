import { hash, verify } from "@node-rs/argon2";
import { randomBytes } from "crypto";
import { eq, and, gt } from "drizzle-orm";
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

export type ValidateCredentialsResult =
  | { success: true; userId: string }
  | { success: false; reason: "invalid_credentials" | "account_locked" | "account_inactive" };

export type TokenOperationResult =
  | { success: true }
  | { success: false; reason: "token_not_found" | "token_expired" };

// ---------------------------------------------------------------------------
// Funções puras de autenticação
// ---------------------------------------------------------------------------

/**
 * Valida e-mail e senha contra o banco.
 * Gerencia contador de tentativas e bloqueio temporário.
 */
export async function validateCredentials(
  email: string,
  password: string,
  db: AuthDb
): Promise<ValidateCredentialsResult> {
  const { users } = await import("@gestao-de-quadras/db/schema");

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);

  if (!user || !user.passwordHash) {
    return { success: false, reason: "invalid_credentials" };
  }

  // Verifica se a conta ainda está bloqueada
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { success: false, reason: "account_locked" };
  }

  // Verifica se a conta já foi ativada
  if (!user.activatedAt) {
    return { success: false, reason: "account_inactive" };
  }

  const passwordValid = await verify(user.passwordHash, password);

  if (!passwordValid) {
    const newFailedAttempts = user.failedAttempts + 1;
    const shouldLock = newFailedAttempts >= MAX_FAILED_ATTEMPTS;

    await db
      .update(users)
      .set({
        failedAttempts: newFailedAttempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return { success: false, reason: shouldLock ? "account_locked" : "invalid_credentials" };
  }

  // Login bem-sucedido: zera o contador
  await db
    .update(users)
    .set({ failedAttempts: 0, lockedUntil: null, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return { success: true, userId: user.id };
}

/**
 * Gera e persiste um token de ativação de conta para o usuário.
 * Retorna o token gerado (deve ser enviado por e-mail, nunca exposto na URL
 * de forma previsível).
 */
export async function createActivationToken(
  userId: string,
  db: AuthDb
): Promise<string> {
  const { users } = await import("@gestao-de-quadras/db/schema");

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ACTIVATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await db
    .update(users)
    .set({ activationToken: token, activationTokenExpiresAt: expiresAt, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return token;
}

/**
 * Ativa a conta do usuário definindo sua senha inicial.
 * Invalida o token após uso.
 */
export async function activateAccount(
  token: string,
  newPassword: string,
  db: AuthDb
): Promise<TokenOperationResult> {
  const { users } = await import("@gestao-de-quadras/db/schema");

  const now = new Date();

  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.activationToken, token),
        gt(users.activationTokenExpiresAt!, now)
      )
    )
    .limit(1);

  if (!user) {
    // Pode ser token inválido OU expirado — verificar qual
    const [anyUser] = await db
      .select({ activationTokenExpiresAt: users.activationTokenExpiresAt })
      .from(users)
      .where(eq(users.activationToken, token))
      .limit(1);

    return { success: false, reason: anyUser ? "token_expired" : "token_not_found" };
  }

  const passwordHash = await hash(newPassword);

  await db
    .update(users)
    .set({
      passwordHash,
      activatedAt: now,
      activationToken: null,
      activationTokenExpiresAt: null,
      updatedAt: now,
    })
    .where(eq(users.id, user.id));

  return { success: true };
}

/**
 * Cria token de recuperação de senha e o persiste.
 * Retorna o token ou null se o e-mail não for encontrado.
 * (Nunca revelar se o e-mail existe — usar a mesma mensagem ao usuário)
 */
export async function createPasswordResetToken(
  email: string,
  db: AuthDb
): Promise<string | null> {
  const { users } = await import("@gestao-de-quadras/db/schema");

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);

  if (!user) {
    return null;
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await db
    .update(users)
    .set({ resetToken: token, resetTokenExpiresAt: expiresAt, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return token;
}

/**
 * Redefine a senha usando o token de recuperação.
 * Invalida o token após uso.
 */
export async function resetPassword(
  token: string,
  newPassword: string,
  db: AuthDb
): Promise<TokenOperationResult> {
  const { users } = await import("@gestao-de-quadras/db/schema");

  const now = new Date();

  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.resetToken, token),
        gt(users.resetTokenExpiresAt!, now)
      )
    )
    .limit(1);

  if (!user) {
    const [anyUser] = await db
      .select({ resetTokenExpiresAt: users.resetTokenExpiresAt })
      .from(users)
      .where(eq(users.resetToken, token))
      .limit(1);

    return { success: false, reason: anyUser ? "token_expired" : "token_not_found" };
  }

  const passwordHash = await hash(newPassword);

  await db
    .update(users)
    .set({
      passwordHash,
      resetToken: null,
      resetTokenExpiresAt: null,
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: now,
    })
    .where(eq(users.id, user.id));

  return { success: true };
}
