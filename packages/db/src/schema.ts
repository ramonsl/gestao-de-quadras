import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  integer,
  boolean,
  uniqueIndex,
  date,
  index,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Modelo multi-tenant: DISCRIMINADOR POR LINHA (row-level) + RLS.
//
// Todas as tabelas vivem no schema `public`. As tabelas com escopo de arena
// carregam `tenant_id` e são protegidas por Row-Level Security (a política e o
// ENABLE RLS ficam nas migrations, não no Drizzle) e está previsto como reforço.
// O isolamento é imposto pelos serviços via filtro `tenant_id` no
// `TenantContext` (packages/core/src/db/tenant.ts) — ver "Regra inviolável #1".
// ---------------------------------------------------------------------------

// --- Globais (sem tenant_id) ------------------------------------------------

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  /** active | suspended | cancelled */
  status: varchar("status", { length: 20 }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Usuários do backoffice do SaaS (SAAS-11) — global. */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash"),
  activatedAt: timestamp("activated_at"),
  activationToken: text("activation_token"),
  activationTokenExpiresAt: timestamp("activation_token_expires_at"),
  resetToken: text("reset_token"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at"),
  failedAttempts: integer("failed_attempts").default(0).notNull(),
  lockedUntil: timestamp("locked_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Clientes GLOBAIS — identidade única por WhatsApp (CAD-01), compartilhada
 * entre arenas. NÃO tem tenant_id (é cross-arena por definição).
 */
export const globalCustomers = pgTable(
  "global_customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    whatsapp: varchar("whatsapp", { length: 15 }).notNull().unique(),
    name: varchar("name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }),
    birthDate: date("birth_date"),
    photoUrl: text("photo_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    whatsappIdx: uniqueIndex("global_customers_whatsapp_unique").on(t.whatsapp),
    nameIdx: index("global_customers_name_idx").on(t.name),
  })
);

/** Coluna padrão de escopo de arena (row-level). */
const tenantId = () =>
  uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" });

// --- Escopo de arena (com tenant_id + RLS) ----------------------------------

/**
 * Operadores da arena (SAAS-12): Admin, Gerente, Atendente.
 * `username` é único por arena; `email` (opcional) também.
 */
export const usersTenants = pgTable(
  "users_tenants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    username: varchar("username", { length: 50 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 20 }),
    passwordHash: text("password_hash"),
    /** admin | gerente | atendente */
    role: varchar("role", { length: 20 }).notNull(),
    modulesAllowed: text("modules_allowed").notNull().default("[]"),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    mustChangePassword: boolean("must_change_password").default(false).notNull(),
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
    usernameUnique: uniqueIndex("users_tenants_username_unique").on(t.tenantId, t.username),
    emailUnique: uniqueIndex("users_tenants_email_unique")
      .on(t.tenantId, t.email)
      .where(sql`${t.email} IS NOT NULL`),
  })
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    /** Operador que realizou a ação (users_tenants.id) */
    userId: uuid("user_id").notNull(),
    action: text("action").notNull(),
    details: text("details"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    tenantIdx: index("audit_logs_tenant_idx").on(t.tenantId),
  })
);

/** Clientes LOCAIS — vínculo com a arena (CAD-01). */
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    globalCustomerId: uuid("global_customer_id"),
    whatsapp: varchar("whatsapp", { length: 15 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }),
    birthDate: date("birth_date"),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    createdByUserId: uuid("created_by_user_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    whatsappUnique: uniqueIndex("customers_tenant_whatsapp_unique").on(t.tenantId, t.whatsapp),
    globalIdIdx: index("customers_global_id_idx").on(t.tenantId, t.globalCustomerId),
    nameIdx: index("customers_name_idx").on(t.tenantId, t.name),
  })
);

export const customerOptInLgpd = pgTable(
  "customer_opt_in_lgpd",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    customerId: uuid("customer_id").notNull(),
    optIn: boolean("opt_in").default(false).notNull(),
    optInAt: timestamp("opt_in_at"),
    optOutAt: timestamp("opt_out_at"),
    changedByUserId: uuid("changed_by_user_id"),
    changedAt: timestamp("changed_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    customerIdUnique: uniqueIndex("customer_opt_in_lgpd_customer_id_unique").on(t.customerId),
    optInIdx: index("customer_opt_in_lgpd_opt_in_idx").on(t.tenantId, t.optIn),
  })
);

// --- Produtos da copa e estoque (CAD-02) ------------------------------------

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    name: varchar("name", { length: 255 }).notNull(),
    barcode: varchar("barcode", { length: 100 }),
    salePriceCents: integer("sale_price_cents").notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    currentStock: integer("current_stock").default(0).notNull(),
    minStock: integer("min_stock").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    barcodeIdx: index("products_barcode_idx").on(t.tenantId, t.barcode),
    categoryIdx: index("products_category_idx").on(t.tenantId, t.category),
  })
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantityChange: integer("quantity_change").notNull(),
    reason: varchar("reason", { length: 50 }).notNull(),
    userId: uuid("user_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    productIdIdx: index("stock_movements_product_id_idx").on(t.productId),
  })
);

// --- Quadras, Serviços e Aulas (CAD-03, CAD-05) -----------------------------

export const courts = pgTable(
  "courts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    name: varchar("name", { length: 100 }).notNull(),
    modality: varchar("modality", { length: 50 }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    modalityIdx: index("courts_modality_idx").on(t.tenantId, t.modality),
    isActiveIdx: index("courts_is_active_idx").on(t.tenantId, t.isActive),
  })
);

export const courtServices = pgTable(
  "court_services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    courtId: uuid("court_id").notNull(),
    serviceType: varchar("service_type", { length: 50 }).notNull(),
    basePriceInCents: integer("base_price_in_cents").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    courtIdIdx: index("court_services_court_id_idx").on(t.courtId),
    serviceTypeIdx: index("court_services_service_type_idx").on(t.tenantId, t.serviceType),
  })
);

export const courtTimeSlots = pgTable(
  "court_time_slots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    courtId: uuid("court_id").notNull(),
    dayOfWeek: integer("day_of_week").notNull(),
    startTimeHHMM: varchar("start_time_hhmm", { length: 5 }).notNull(),
    endTimeHHMM: varchar("end_time_hhmm", { length: 5 }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    priceInCents: integer("price_in_cents").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    courtIdIdx: index("court_time_slots_court_id_idx").on(t.courtId),
    dayOfWeekIdx: index("court_time_slots_day_of_week_idx").on(t.tenantId, t.dayOfWeek),
  })
);

export const classPackages = pgTable(
  "class_packages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    name: varchar("name", { length: 100 }).notNull(),
    totalClassCount: integer("total_class_count").notNull(),
    priceInCents: integer("price_in_cents").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    isActiveIdx: index("class_packages_is_active_idx").on(t.tenantId, t.isActive),
  })
);

export const studentClassBalance = pgTable(
  "student_class_balance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    globalCustomerId: uuid("global_customer_id").notNull(),
    classPackageId: uuid("class_package_id").notNull(),
    remainingClasses: integer("remaining_classes").notNull(),
    purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    globalCustomerIdIdx: index("student_class_balance_global_customer_id_idx").on(t.globalCustomerId),
    classPackageIdIdx: index("student_class_balance_class_package_id_idx").on(t.classPackageId),
  })
);

// ---------------------------------------------------------------------------
// Tabelas com escopo de arena (protegidas por RLS). Fonte única para o runner
// de migrations habilitar RLS e para testes de isolamento.
// ---------------------------------------------------------------------------

export const TENANT_SCOPED_TABLES = [
  "users_tenants",
  "audit_logs",
  "customers",
  "customer_opt_in_lgpd",
  "products",
  "stock_movements",
  "courts",
  "court_services",
  "court_time_slots",
  "class_packages",
  "student_class_balance",
] as const;

// ---------------------------------------------------------------------------
// Types utilitários derivados do schema
// ---------------------------------------------------------------------------

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type GlobalCustomer = typeof globalCustomers.$inferSelect;
export type NewGlobalCustomer = typeof globalCustomers.$inferInsert;
export type ArenaUser = typeof usersTenants.$inferSelect;
export type NewArenaUser = typeof usersTenants.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type CustomerOptInLgpd = typeof customerOptInLgpd.$inferSelect;
export type NewCustomerOptInLgpd = typeof customerOptInLgpd.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type StockMovement = typeof stockMovements.$inferSelect;
export type NewStockMovement = typeof stockMovements.$inferInsert;
export type Court = typeof courts.$inferSelect;
export type NewCourt = typeof courts.$inferInsert;
export type CourtService = typeof courtServices.$inferSelect;
export type NewCourtService = typeof courtServices.$inferInsert;
export type CourtTimeSlot = typeof courtTimeSlots.$inferSelect;
export type NewCourtTimeSlot = typeof courtTimeSlots.$inferInsert;
export type ClassPackage = typeof classPackages.$inferSelect;
export type NewClassPackage = typeof classPackages.$inferInsert;
export type StudentClassBalance = typeof studentClassBalance.$inferSelect;
export type NewStudentClassBalance = typeof studentClassBalance.$inferInsert;
