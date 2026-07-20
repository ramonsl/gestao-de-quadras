-- CAD-01: Cadastro de Clientes, LGPD e Identidade Global

-- ============================================================================
-- Schema PUBLIC — Clientes Globais (identidade única)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."global_customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "whatsapp" varchar(15) NOT NULL UNIQUE,
  "name" varchar(100) NOT NULL,
  "email" varchar(255),
  "birth_date" date,
  "photo_url" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "global_customers_whatsapp_unique"
  ON "public"."global_customers"("whatsapp");

-- ============================================================================
-- Schema TENANT — Clientes Locais + Consentimento LGPD
-- ============================================================================

CREATE TABLE IF NOT EXISTS "tenant_template"."customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "global_customer_id" uuid,
  "whatsapp" varchar(15) NOT NULL,
  "name" varchar(100) NOT NULL,
  "email" varchar(255),
  "birth_date" date,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "customers_whatsapp_unique"
  ON "tenant_template"."customers"("whatsapp");
CREATE INDEX IF NOT EXISTS "customers_global_id_idx"
  ON "tenant_template"."customers"("global_customer_id");
CREATE INDEX IF NOT EXISTS "customers_name_idx"
  ON "tenant_template"."customers"("name");

-- Consentimento LGPD isolado por arena
CREATE TABLE IF NOT EXISTS "tenant_template"."customer_opt_in_lgpd" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL UNIQUE,
  "opt_in" boolean DEFAULT false NOT NULL,
  "opt_in_at" timestamp,
  "opt_out_at" timestamp,
  "changed_by_user_id" uuid,
  "changed_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "customer_opt_in_lgpd_customer_id_unique"
  ON "tenant_template"."customer_opt_in_lgpd"("customer_id");
CREATE INDEX IF NOT EXISTS "customer_opt_in_lgpd_opt_in_idx"
  ON "tenant_template"."customer_opt_in_lgpd"("opt_in");
