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

// --- PDV — Comandas e Itens (PDV-02, PDV-03) --------------------------------

/**
 * Comanda: identificada (customer_id preenchido), aberta por cadastro rápido
 * de cliente (mesmo caso, customer_id preenchido), ou balcão/anônima — nesse
 * caso `customer_id` nulo é o próprio discriminador (PDV-03), sem flag extra.
 * Sem FK em `customer_id`: uma exclusão/anonimização LGPD (CAD-06) de cliente
 * não pode travar nem cascatear a exclusão do histórico financeiro.
 */
export const comandas = pgTable(
  "comandas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    customerId: uuid("customer_id"),
    /** open | closed — fechamento/pagamento é PDV-07, fora desta fase. */
    status: varchar("status", { length: 20 }).default("open").notNull(),
    openedByUserId: uuid("opened_by_user_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    tenantStatusIdx: index("comandas_tenant_status_idx").on(t.tenantId, t.status),
    tenantCustomerIdx: index("comandas_tenant_customer_idx").on(t.tenantId, t.customerId),
  })
);

/**
 * Item lançado numa comanda (PDV-02 AC4): `productNameAtSale` e
 * `unitPriceCentsAtSale` são snapshots imutáveis do momento do lançamento —
 * nunca recalculados a partir do catálogo vigente (regra 10, CLAUDE.md).
 * Sem FK em `product_id`: excluir um produto do catálogo nunca pode apagar
 * nem travar por causa de um lançamento financeiro já gravado.
 */
export const comandaItems = pgTable(
  "comanda_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    comandaId: uuid("comanda_id")
      .notNull()
      .references(() => comandas.id, { onDelete: "cascade" }),
    /** 'product' (copa/estoque) | 'court_rental' (locação de quadra — PDV-05). */
    itemType: varchar("item_type", { length: 20 }).default("product").notNull(),
    /** null para locação de quadra (não é produto do catálogo). */
    productId: uuid("product_id"),
    /** Locação vinculada (PDV-05); null para itens de produto. Sem FK dura para não travar. */
    courtBookingId: uuid("court_booking_id"),
    productNameAtSale: varchar("product_name_at_sale", { length: 255 }).notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCentsAtSale: integer("unit_price_cents_at_sale").notNull(),
    operatorUserId: uuid("operator_user_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    tenantComandaIdx: index("comanda_items_tenant_comanda_idx").on(t.tenantId, t.comandaId),
  })
);

/**
 * Pagamento realizado em uma comanda (PDV-07): registra a forma de pagamento,
 * valor atribuído (centavos), valor entregue em dinheiro e troco.
 */
export const comandaPayments = pgTable(
  "comanda_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    comandaId: uuid("comanda_id")
      .notNull()
      .references(() => comandas.id, { onDelete: "cascade" }),
    cashSessionId: uuid("cash_session_id").references(() => cashSessions.id, { onDelete: "set null" }),
    /** dinheiro | pix | cartao_credito | cartao_debito | pontos */
    paymentMethod: varchar("payment_method", { length: 50 }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    receivedCents: integer("received_cents"),
    changeCents: integer("change_cents").default(0).notNull(),
    operatorUserId: uuid("operator_user_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    tenantComandaIdx: index("comanda_payments_tenant_comanda_idx").on(t.tenantId, t.comandaId),
    tenantSessionIdx: index("comanda_payments_tenant_session_idx").on(t.tenantId, t.cashSessionId),
  })
);

/**
 * Sessão / Turno de caixa (PDV-01): gerencia a abertura (troco inicial),
 * o fechamento (contagem física e cálculo de quebra/sobra) e o operador responsável.
 */
export const cashSessions = pgTable(
  "cash_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    operatorUserId: uuid("operator_user_id").notNull(),
    closedByUserId: uuid("closed_by_user_id"),
    /** open | closed */
    status: varchar("status", { length: 20 }).default("open").notNull(),
    initialCashCents: integer("initial_cash_cents").notNull(),
    openedAt: timestamp("opened_at").defaultNow().notNull(),
    closedAt: timestamp("closed_at"),
    closingNotes: text("closing_notes"),
  },
  (t) => ({
    tenantStatusIdx: index("cash_sessions_tenant_status_idx").on(t.tenantId, t.status),
  })
);

/**
 * Movimentação manual de caixa (PDV-01): sangria (retirada) ou suprimento (entrada de troco).
 */
export const cashMovements = pgTable(
  "cash_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    cashSessionId: uuid("cash_session_id")
      .notNull()
      .references(() => cashSessions.id, { onDelete: "cascade" }),
    /** sangria | suprimento */
    type: varchar("type", { length: 20 }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    reason: text("reason").notNull(),
    operatorUserId: uuid("operator_user_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    tenantSessionIdx: index("cash_movements_tenant_session_idx").on(t.tenantId, t.cashSessionId),
  })
);

/**
 * Contagem física realizada no fechamento de caixa por meio de pagamento (PDV-01).
 */
export const cashClosingCounts = pgTable(
  "cash_closing_counts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    cashSessionId: uuid("cash_session_id")
      .notNull()
      .references(() => cashSessions.id, { onDelete: "cascade" }),
    paymentMethod: varchar("payment_method", { length: 50 }).notNull(),
    expectedCents: integer("expected_cents").notNull(),
    countedCents: integer("counted_cents").notNull(),
    differenceCents: integer("difference_cents").notNull(),
  },
  (t) => ({
    tenantSessionIdx: index("cash_closing_counts_tenant_session_idx").on(t.tenantId, t.cashSessionId),
  })
);

export const customerDebits = pgTable(
  "customer_debits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    comandaId: uuid("comanda_id").references(() => comandas.id, { onDelete: "set null" }),
    amountCents: integer("amount_cents").notNull(),
    paidCents: integer("paid_cents").default(0).notNull(),
    status: varchar("status", { length: 30 }).default("pending").notNull(),
    operatorUserId: uuid("operator_user_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    tenantCustomerIdx: index("customer_debits_tenant_customer_idx").on(t.tenantId, t.customerId),
  })
);

export const customerDebitPayments = pgTable(
  "customer_debit_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    customerDebitId: uuid("customer_debit_id")
      .notNull()
      .references(() => customerDebits.id, { onDelete: "cascade" }),
    cashSessionId: uuid("cash_session_id").references(() => cashSessions.id, { onDelete: "set null" }),
    paymentMethod: varchar("payment_method", { length: 50 }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    operatorUserId: uuid("operator_user_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    tenantDebitIdx: index("customer_debit_payments_tenant_debit_idx").on(t.tenantId, t.customerDebitId),
    tenantSessionIdx: index("customer_debit_payments_tenant_session_idx").on(t.tenantId, t.cashSessionId),
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

/**
 * Locação de quadra (PDV-05): uma marcação na grade (quadra × faixa horária ×
 * dia). `price_cents_at_booking` é snapshot imutável do preço da faixa no momento
 * da locação (regra 6/10). A dupla-marcação é impedida de forma RÍGIDA por um
 * índice único parcial (tenant + quadra + dia + horário, exceto canceladas).
 * `status`: 'booked' (Ocupado) | 'reserved' (reserva online pendente — RES-01,
 * ainda sem fonte de dados) | 'cancelled'.
 */
export const courtBookings = pgTable(
  "court_bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    courtId: uuid("court_id").notNull(),
    /** Rastreio da faixa de origem (CAD-05); sem FK, a faixa pode ser editada depois. */
    courtTimeSlotId: uuid("court_time_slot_id"),
    bookingDate: date("booking_date").notNull(),
    startTimeHHMM: varchar("start_time_hhmm", { length: 5 }).notNull(),
    endTimeHHMM: varchar("end_time_hhmm", { length: 5 }).notNull(),
    priceCentsAtBooking: integer("price_cents_at_booking").notNull(),
    status: varchar("status", { length: 20 }).default("booked").notNull(),
    comandaId: uuid("comanda_id").references(() => comandas.id, { onDelete: "set null" }),
    /** Sem FK (mesma razão de comandas.customer_id: não travar anonimização LGPD). */
    customerId: uuid("customer_id"),
    createdByUserId: uuid("created_by_user_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    /** Guarda RÍGIDA anti-dupla-marcação (AC4): uma marcação ativa por quadra/dia/horário. */
    noDoubleBookingIdx: uniqueIndex("court_bookings_no_double_idx")
      .on(t.tenantId, t.courtId, t.bookingDate, t.startTimeHHMM)
      .where(sql`status <> 'cancelled'`),
    tenantDateIdx: index("court_bookings_tenant_date_idx").on(t.tenantId, t.bookingDate),
    tenantComandaIdx: index("court_bookings_tenant_comanda_idx").on(t.tenantId, t.comandaId),
  })
);

// --- Conexão WhatsApp / Baileys (WPP-01) ------------------------------------

/**
 * Estado de conexão do WhatsApp da arena (v1: 1 número por tenant).
 * `status`: disconnected | connecting | qr_pending | connected | disconnected_permanent
 */
export const whatsappConnections = pgTable(
  "whatsapp_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    status: varchar("status", { length: 30 }).default("disconnected").notNull(),
    /** E.164 — só preenchido após status = connected. */
    phoneNumber: varchar("phone_number", { length: 20 }),
    /** Payload cru do QR (renderizado no client) — null fora de qr_pending. */
    qrCode: text("qr_code"),
    qrGeneratedAt: timestamp("qr_generated_at"),
    connectedAt: timestamp("connected_at"),
    lastDisconnectedAt: timestamp("last_disconnected_at"),
    disconnectReason: text("disconnect_reason"),
    reconnectAttempts: integer("reconnect_attempts").default(0).notNull(),
    /** Dedupe do e-mail de alerta (AC4) — nunca reenviar em loop de reconexão. */
    permanentAlertSentAt: timestamp("permanent_alert_sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    tenantUnique: uniqueIndex("whatsapp_connections_tenant_unique").on(t.tenantId),
  })
);

/** Credenciais Baileys (AuthenticationCreds) — segredo de sessão, 1 linha por tenant. */
export const whatsappAuthCreds = pgTable(
  "whatsapp_auth_creds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    credsJson: text("creds_json").notNull().default("{}"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    tenantUnique: uniqueIndex("whatsapp_auth_creds_tenant_unique").on(t.tenantId),
  })
);

/** Chaves de sinal Baileys (pre-keys, sessions, sender-keys, app-state-sync-*). */
export const whatsappAuthKeys = pgTable(
  "whatsapp_auth_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    keyType: varchar("key_type", { length: 40 }).notNull(),
    keyId: varchar("key_id", { length: 120 }).notNull(),
    keyData: text("key_data").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    tenantKeyUnique: uniqueIndex("whatsapp_auth_keys_tenant_key_unique").on(
      t.tenantId,
      t.keyType,
      t.keyId
    ),
  })
);

// --- Publicidade — Espaços e Anunciantes (PUB-01) ---------------------------

/** Espaço publicitário físico/digital da arena (placa, lona, banner). */
export const adSpaces = pgTable(
  "ad_spaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    /** Identificação, ex.: "Placa 1 - Fundo da Quadra 1". */
    name: varchar("name", { length: 120 }).notNull(),
    /** placa_fisica | lona | banner_digital */
    spaceType: varchar("space_type", { length: 20 }).notNull(),
    /** disponivel | ocupado | manutencao */
    status: varchar("status", { length: 20 }).default("disponivel").notNull(),
    /** Valor de referência de locação (centavos). */
    referencePriceCents: integer("reference_price_cents").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index("ad_spaces_status_idx").on(t.tenantId, t.status),
    typeIdx: index("ad_spaces_type_idx").on(t.tenantId, t.spaceType),
  })
);

/** Anunciante (empresa parceira) da arena. */
export const advertisers = pgTable(
  "advertisers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    /** Razão social / nome. */
    name: varchar("name", { length: 150 }).notNull(),
    /** CNPJ (14) ou CPF (11) — apenas dígitos. */
    document: varchar("document", { length: 14 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 20 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    documentUnique: uniqueIndex("advertisers_tenant_document_unique").on(t.tenantId, t.document),
    nameIdx: index("advertisers_name_idx").on(t.tenantId, t.name),
  })
);

/**
 * Configurações do Programa de Pontos / Cashback (PTS-01 / PDV-08).
 * Define se o programa está ativo na arena, regras de acúmulo, taxa de resgate e limites.
 */
export const pointsSettings = pgTable(
  "points_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    enabled: boolean("enabled").default(false).notNull(),
    /** Taxa de acúmulo: centavos gastos por 1 ponto obtido (ex.: 100 centavos = R$ 1,00 por ponto). */
    earnRateCentsPerPoint: integer("earn_rate_cents_per_point").default(100).notNull(),
    /** Taxa de resgate: quantos pontos equivalem a R$ 1,00 de desconto (ex.: 100 pontos = R$ 1,00). */
    redemptionPointsPerReal: integer("redemption_points_per_real").default(100).notNull(),
    /** Limite máximo de abatimento da comanda em pontos (%) — ex.: 50 para 50%. */
    maxRedemptionPercentage: integer("max_redemption_percentage").default(50).notNull(),
    /** 'all' (todos os clientes) ou 'affiliates_only' (apenas filiados). */
    allowedParticipants: varchar("allowed_participants", { length: 30 }).default("all").notNull(),
    /** Período de expiração em dias (ex.: 180). */
    expirationDays: integer("expiration_days").default(180).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    tenantUnique: uniqueIndex("points_settings_tenant_unique").on(t.tenantId),
  })
);

/** Saldo consolidado de pontos do cliente por arena. */
export const customerPointsBalance = pgTable(
  "customer_points_balance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    balance: integer("balance").default(0).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    customerUnique: uniqueIndex("customer_points_balance_tenant_customer_unique").on(t.tenantId, t.customerId),
  })
);

/** Histórico/extrato de movimentações de pontos do cliente. */
export const customerPointsTransactions = pgTable(
  "customer_points_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: tenantId(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    /** Quantidade de pontos (positivo para crédito/ganho, negativo para débito/resgate/expiração). */
    amountPoints: integer("amount_points").notNull(),
    /** 'earn' | 'redeem' | 'expire' | 'adjustment' */
    transactionType: varchar("transaction_type", { length: 30 }).notNull(),
    /** ID de referência (ex.: comanda_id). */
    referenceId: uuid("reference_id"),
    description: text("description"),
    operatorUserId: uuid("operator_user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    tenantCustomerIdx: index("customer_points_tx_tenant_customer_idx").on(t.tenantId, t.customerId),
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
  "comandas",
  "comanda_items",
  "comanda_payments",
  "cash_sessions",
  "cash_movements",
  "cash_closing_counts",
  "courts",
  "court_services",
  "court_time_slots",
  "court_bookings",
  "ad_spaces",
  "advertisers",
  "class_packages",
  "student_class_balance",
  "whatsapp_connections",
  "whatsapp_auth_creds",
  "whatsapp_auth_keys",
  "points_settings",
  "customer_points_balance",
  "customer_points_transactions",
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
export type Comanda = typeof comandas.$inferSelect;
export type NewComanda = typeof comandas.$inferInsert;
export type ComandaItem = typeof comandaItems.$inferSelect;
export type NewComandaItem = typeof comandaItems.$inferInsert;
export type ComandaPayment = typeof comandaPayments.$inferSelect;
export type NewComandaPayment = typeof comandaPayments.$inferInsert;
export type CashSession = typeof cashSessions.$inferSelect;
export type NewCashSession = typeof cashSessions.$inferInsert;
export type CashMovement = typeof cashMovements.$inferSelect;
export type NewCashMovement = typeof cashMovements.$inferInsert;
export type CashClosingCount = typeof cashClosingCounts.$inferSelect;
export type NewCashClosingCount = typeof cashClosingCounts.$inferInsert;
export type CustomerDebit = typeof customerDebits.$inferSelect;
export type NewCustomerDebit = typeof customerDebits.$inferInsert;
export type CustomerDebitPayment = typeof customerDebitPayments.$inferSelect;
export type NewCustomerDebitPayment = typeof customerDebitPayments.$inferInsert;
export type Court = typeof courts.$inferSelect;
export type NewCourt = typeof courts.$inferInsert;
export type CourtService = typeof courtServices.$inferSelect;
export type NewCourtService = typeof courtServices.$inferInsert;
export type CourtTimeSlot = typeof courtTimeSlots.$inferSelect;
export type NewCourtTimeSlot = typeof courtTimeSlots.$inferInsert;
export type CourtBooking = typeof courtBookings.$inferSelect;
export type NewCourtBooking = typeof courtBookings.$inferInsert;
export type ClassPackage = typeof classPackages.$inferSelect;
export type NewClassPackage = typeof classPackages.$inferInsert;
export type StudentClassBalance = typeof studentClassBalance.$inferSelect;
export type NewStudentClassBalance = typeof studentClassBalance.$inferInsert;
export type WhatsappConnection = typeof whatsappConnections.$inferSelect;
export type NewWhatsappConnection = typeof whatsappConnections.$inferInsert;
export type WhatsappAuthCreds = typeof whatsappAuthCreds.$inferSelect;
export type NewWhatsappAuthCreds = typeof whatsappAuthCreds.$inferInsert;
export type WhatsappAuthKey = typeof whatsappAuthKeys.$inferSelect;
export type NewWhatsappAuthKey = typeof whatsappAuthKeys.$inferInsert;
export type AdSpace = typeof adSpaces.$inferSelect;
export type NewAdSpace = typeof adSpaces.$inferInsert;
export type Advertiser = typeof advertisers.$inferSelect;
export type NewAdvertiser = typeof advertisers.$inferInsert;
export type PointsSettings = typeof pointsSettings.$inferSelect;
export type NewPointsSettings = typeof pointsSettings.$inferInsert;
export type CustomerPointsBalance = typeof customerPointsBalance.$inferSelect;
export type NewCustomerPointsBalance = typeof customerPointsBalance.$inferInsert;
export type CustomerPointsTransactions = typeof customerPointsTransactions.$inferSelect;
export type NewCustomerPointsTransactions = typeof customerPointsTransactions.$inferInsert;

