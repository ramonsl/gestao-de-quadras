import { pgSchema, pgTable, uuid, varchar, timestamp, text } from "drizzle-orm/pg-core";

// Schema global 'public' para controle de inquilinos e contas principais
export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  status: varchar("status", { length: 20 }).default("active").notNull(), // active, suspended, cancelled
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Definição das tabelas de tenant no schema padrão para migração
export const tenantSchema = pgSchema("tenant_template");

export const usersTenants = tenantSchema.table("users_tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  role: varchar("role", { length: 20 }).notNull(), // admin, gerente, atendente
  status: varchar("status", { length: 20 }).default("active").notNull(), // active, inactive
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogs = tenantSchema.table("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
