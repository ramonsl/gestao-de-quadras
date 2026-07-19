import {
  pgSchema,
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  integer,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Schema GLOBAL (public) — controle de tenants e usuários corporativos
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
 * Usuários corporativos das arenas (Admins, Gerentes, Atendentes).
 * Autenticação via Auth.js com Credentials Provider + argon2id.
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
 * Vínculo usuário × arena com perfil e módulos permitidos.
 * Reflete SAAS-02 e SAAS-10: roles e matriz de permissões por módulo.
 */
export const usersTenants = tenantSchema.table("users_tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(), // FK para public.users
  /** admin | gerente | atendente */
  role: varchar("role", { length: 20 }).notNull(),
  /**
   * Lista de módulos habilitados para este usuário nesta arena.
   * Ex.: ['pdv', 'quadras', 'crm', 'filiacao', 'pontos', 'publicidade', 'relatorios', 'whatsapp']
   * Serializado como JSON array em coluna text para compatibilidade com Neon serverless.
   */
  modulesAllowed: text("modules_allowed").notNull().default("[]"),
  /** active | inactive */
  status: varchar("status", { length: 20 }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const auditLogs = tenantSchema.table("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
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
