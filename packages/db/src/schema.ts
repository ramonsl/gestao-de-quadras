import {
  pgSchema,
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  integer,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Schema GLOBAL (public) — controle de tenants e identidades globais
// ---------------------------------------------------------------------------

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  /** active | suspended | cancelled */
  status: varchar("status", { length: 20 }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Identidades GLOBAIS (schema public), compartilhadas entre arenas.
 *
 * NÃO representa os operadores da arena (funcionários) — esses vivem no schema
 * de cada tenant, em `users_tenants` (ver SAAS-12). Esta tabela é reservada para
 * atores globais cross-arena: atletas/clientes (CAD-01) e usuários do backoffice
 * do SaaS (SAAS-11).
 */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash"),

  /** null = conta pendente de ativação */
  activatedAt: timestamp("activated_at"),
  activationToken: text("activation_token"),
  activationTokenExpiresAt: timestamp("activation_token_expires_at"),

  /** Token único de recuperação de senha (expira em 24h) */
  resetToken: text("reset_token"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at"),

  /** Contador de tentativas de login falhas; zera no login bem-sucedido */
  failedAttempts: integer("failed_attempts").default(0).notNull(),
  /** Quando preenchido, o login é bloqueado até este instante */
  lockedUntil: timestamp("locked_until"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Schema TEMPLATE (tenant_template) — replicado para cada arena
// ---------------------------------------------------------------------------

export const tenantSchema = pgSchema("tenant_template");

/**
 * Operadores da arena (funcionários): Admin, Gerente, Atendente (SAAS-12).
 *
 * É uma entidade DO TENANT — vive no schema da arena e é autossuficiente
 * (guarda as próprias credenciais). Autenticação via Auth.js + argon2id, com o
 * tenant resolvido pelo subdomínio antes do login (ver SAAS-03).
 *
 * `username` é o identificador de login, único dentro do tenant (índice único
 * por schema). `email` é opcional — a maioria dos operadores não possui.
 */
export const usersTenants = tenantSchema.table(
  "users_tenants",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** Login do operador — único no tenant */
    username: varchar("username", { length: 50 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    /** Opcional; quando presente, habilita recuperação de senha por e-mail */
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 20 }),

    /** argon2id; null = conta pendente de ativação por token */
    passwordHash: text("password_hash"),

    /** admin | gerente | atendente */
    role: varchar("role", { length: 20 }).notNull(),
    /**
     * Módulos habilitados para este operador nesta arena. JSON array em text
     * para compatibilidade com Neon serverless. Slugs canônicos em
     * `packages/core/src/users/modules.ts`.
     */
    modulesAllowed: text("modules_allowed").notNull().default("[]"),
    /** active | inactive — inativo bloqueia o login imediatamente */
    status: varchar("status", { length: 20 }).default("active").notNull(),
    /** Força a troca de senha no próximo login (configurável pelo Admin) */
    mustChangePassword: boolean("must_change_password").default(false).notNull(),

    // --- Segurança / ciclo de vida da credencial (por tenant) ---
    activatedAt: timestamp("activated_at"),
    activationToken: text("activation_token"),
    activationTokenExpiresAt: timestamp("activation_token_expires_at"),
    resetToken: text("reset_token"),
    resetTokenExpiresAt: timestamp("reset_token_expires_at"),
    failedAttempts: integer("failed_attempts").default(0).notNull(),
    lockedUntil: timestamp("locked_until"),
    lastLoginAt: timestamp("last_login_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    usernameUnique: uniqueIndex("users_tenants_username_unique").on(t.username),
  })
);

export const auditLogs = tenantSchema.table("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Operador que realizou a ação (users_tenants.id) */
  userId: uuid("user_id").notNull(),
  action: text("action").notNull(),
  /** JSON com dados anteriores e posteriores à ação */
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Types utilitários derivados do schema
// ---------------------------------------------------------------------------

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ArenaUser = typeof usersTenants.$inferSelect;
export type NewArenaUser = typeof usersTenants.$inferInsert;
