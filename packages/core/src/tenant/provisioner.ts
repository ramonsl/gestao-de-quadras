import { db, tenants } from "@gestao-de-quadras/db";
import { sql } from "drizzle-orm";
import { MODULES } from "../users/modules";

export interface ProvisionInput {
  slug: string;
  name: string;
  /** Admin inicial da arena (operador do tenant) */
  adminName: string;
  adminUsername: string;
  /** Hash argon2 já calculado — o provisioner nunca recebe senha em texto plano */
  adminPasswordHash: string;
  /** Opcional — a maioria dos operadores não possui e-mail */
  adminEmail?: string;
}

const SLUG_PATTERN = /^[a-z0-9-]+$/;

/**
 * Cria dinamicamente um novo schema de tenant no PostgreSQL e insere o
 * inquilino + o operador Admin inicial (dentro do próprio schema do tenant).
 *
 * Operadores são entidades DO tenant (SAAS-12): credenciais vivem em
 * `tenant_<slug>.users_tenants`, não no schema público.
 */
export async function provisionNewTenant(input: ProvisionInput) {
  if (!SLUG_PATTERN.test(input.slug)) {
    throw new Error(
      `Slug inválido: "${input.slug}". Use apenas letras minúsculas, números e hífen.`
    );
  }

  const schemaName = `tenant_${input.slug}`;
  const table = sql`${sql.identifier(schemaName)}.${sql.identifier("users_tenants")}`;
  const auditTable = sql`${sql.identifier(schemaName)}.${sql.identifier("audit_logs")}`;

  // 1. Cria o Tenant global no schema public
  await db.insert(tenants).values({
    slug: input.slug,
    name: input.name,
    status: "active",
  });

  // 2. Cria o schema físico do tenant — RNF-01: isolamento estrito
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS ${sql.identifier(schemaName)}`);

  // 3. Cria as tabelas do tenant (espelham tenant_template do schema.ts)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ${table} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "username" varchar(50) NOT NULL,
      "name" varchar(120) NOT NULL,
      "email" varchar(255),
      "phone" varchar(20),
      "password_hash" text,
      "role" varchar(20) NOT NULL,
      "modules_allowed" text DEFAULT '[]' NOT NULL,
      "status" varchar(20) DEFAULT 'active' NOT NULL,
      "must_change_password" boolean DEFAULT false NOT NULL,
      "activated_at" timestamp,
      "activation_token" text,
      "activation_token_expires_at" timestamp,
      "reset_token" text,
      "reset_token_expires_at" timestamp,
      "failed_attempts" integer DEFAULT 0 NOT NULL,
      "locked_until" timestamp,
      "last_login_at" timestamp,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )
  `);

  // Nomes de índice são escopados por schema — sem sufixo de slug, para não
  // divergir do script de migração e acabar criando um índice duplicado.
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS ${sql.identifier("users_tenants_username_unique")}
    ON ${table} ("username")
  `);

  // E-mail é opcional, mas quando informado precisa ser único no tenant:
  // sem isso, o login por e-mail e o reset por token atingiriam conta arbitrária.
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS ${sql.identifier("users_tenants_email_unique")}
    ON ${table} ("email") WHERE "email" IS NOT NULL
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ${auditTable} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL,
      "action" text NOT NULL,
      "details" text,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `);

  // 3b. Tabelas de negócio do tenant (CAD-01/02/03). Espelham `tenant_template`
  //     do schema.ts, mas criadas no schema físico da arena (Regra inviolável #1).
  const t = (name: string) =>
    sql`${sql.identifier(schemaName)}.${sql.identifier(name)}`;

  // CAD-01: Clientes locais + consentimento LGPD
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ${t("customers")} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "global_customer_id" uuid,
      "whatsapp" varchar(15) NOT NULL,
      "name" varchar(100) NOT NULL,
      "email" varchar(255),
      "birth_date" date,
      "status" varchar(20) DEFAULT 'active' NOT NULL,
      "created_by_user_id" uuid NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS ${sql.identifier("customers_whatsapp_unique")} ON ${t("customers")} ("whatsapp")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS ${sql.identifier("customers_global_id_idx")} ON ${t("customers")} ("global_customer_id")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS ${sql.identifier("customers_name_idx")} ON ${t("customers")} ("name")`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ${t("customer_opt_in_lgpd")} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "customer_id" uuid NOT NULL,
      "opt_in" boolean DEFAULT false NOT NULL,
      "opt_in_at" timestamp,
      "opt_out_at" timestamp,
      "changed_by_user_id" uuid,
      "changed_at" timestamp DEFAULT now() NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS ${sql.identifier("customer_opt_in_lgpd_customer_id_unique")} ON ${t("customer_opt_in_lgpd")} ("customer_id")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS ${sql.identifier("customer_opt_in_lgpd_opt_in_idx")} ON ${t("customer_opt_in_lgpd")} ("opt_in")`);

  // CAD-02: Produtos da copa + movimentação de estoque
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ${t("products")} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "name" varchar(255) NOT NULL,
      "barcode" varchar(100),
      "sale_price_cents" integer NOT NULL,
      "category" varchar(100) NOT NULL,
      "current_stock" integer DEFAULT 0 NOT NULL,
      "min_stock" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS ${sql.identifier("products_barcode_idx")} ON ${t("products")} ("barcode")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS ${sql.identifier("products_category_idx")} ON ${t("products")} ("category")`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ${t("stock_movements")} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "product_id" uuid NOT NULL REFERENCES ${t("products")}("id") ON DELETE CASCADE,
      "quantity_change" integer NOT NULL,
      "reason" varchar(50) NOT NULL,
      "user_id" uuid,
      "notes" text,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS ${sql.identifier("stock_movements_product_id_idx")} ON ${t("stock_movements")} ("product_id")`);

  // CAD-03: Quadras, serviços, faixas horárias, pacotes e saldo de aulas
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ${t("courts")} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "name" varchar(100) NOT NULL,
      "modality" varchar(50) NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS ${sql.identifier("courts_modality_idx")} ON ${t("courts")} ("modality")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS ${sql.identifier("courts_is_active_idx")} ON ${t("courts")} ("is_active")`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ${t("court_services")} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "court_id" uuid NOT NULL,
      "service_type" varchar(50) NOT NULL,
      "base_price_in_cents" integer NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS ${sql.identifier("court_services_court_id_idx")} ON ${t("court_services")} ("court_id")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS ${sql.identifier("court_services_service_type_idx")} ON ${t("court_services")} ("service_type")`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ${t("court_time_slots")} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "court_id" uuid NOT NULL,
      "day_of_week" integer NOT NULL,
      "start_time_hhmm" varchar(5) NOT NULL,
      "end_time_hhmm" varchar(5) NOT NULL,
      "duration_minutes" integer NOT NULL,
      "price_in_cents" integer NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS ${sql.identifier("court_time_slots_court_id_idx")} ON ${t("court_time_slots")} ("court_id")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS ${sql.identifier("court_time_slots_day_of_week_idx")} ON ${t("court_time_slots")} ("day_of_week")`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ${t("class_packages")} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "name" varchar(100) NOT NULL,
      "total_class_count" integer NOT NULL,
      "price_in_cents" integer NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS ${sql.identifier("class_packages_is_active_idx")} ON ${t("class_packages")} ("is_active")`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ${t("student_class_balance")} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "global_customer_id" uuid NOT NULL,
      "class_package_id" uuid NOT NULL,
      "remaining_classes" integer NOT NULL,
      "purchased_at" timestamp DEFAULT now() NOT NULL,
      "expires_at" timestamp,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS ${sql.identifier("student_class_balance_global_customer_id_idx")} ON ${t("student_class_balance")} ("global_customer_id")`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS ${sql.identifier("student_class_balance_class_package_id_idx")} ON ${t("student_class_balance")} ("class_package_id")`);

  // 4. Insere o operador Admin inicial no schema do tenant (já ativo).
  //    Admin tem acesso irrestrito; modulesAllowed recebe todos os módulos.
  const allModules = JSON.stringify([...MODULES]);
  const [admin] = (
    await db.execute<{ id: string }>(sql`
      INSERT INTO ${table}
        ("username", "name", "email", "password_hash", "role", "modules_allowed", "status", "activated_at")
      VALUES (
        ${input.adminUsername},
        ${input.adminName},
        ${input.adminEmail ?? null},
        ${input.adminPasswordHash},
        'admin',
        ${allModules},
        'active',
        now()
      )
      RETURNING "id"
    `)
  ).rows as unknown as Array<{ id: string }>;

  return {
    tenantSlug: input.slug,
    adminUserId: admin.id,
    schemaName,
  };
}
