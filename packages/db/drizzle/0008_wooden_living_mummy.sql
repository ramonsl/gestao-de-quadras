CREATE TABLE IF NOT EXISTS "ad_spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"space_type" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'disponivel' NOT NULL,
	"reference_price_cents" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "advertisers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"document" varchar(14) NOT NULL,
	"email" varchar(255),
	"phone" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cash_closing_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cash_session_id" uuid NOT NULL,
	"payment_method" varchar(50) NOT NULL,
	"expected_cents" integer NOT NULL,
	"counted_cents" integer NOT NULL,
	"difference_cents" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cash_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cash_session_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"amount_cents" integer NOT NULL,
	"reason" text NOT NULL,
	"operator_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cash_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"operator_user_id" uuid NOT NULL,
	"closed_by_user_id" uuid,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"initial_cash_cents" integer NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"closing_notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comanda_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"comanda_id" uuid NOT NULL,
	"cash_session_id" uuid,
	"payment_method" varchar(50) NOT NULL,
	"amount_cents" integer NOT NULL,
	"received_cents" integer,
	"change_cents" integer DEFAULT 0 NOT NULL,
	"operator_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_debit_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_debit_id" uuid NOT NULL,
	"cash_session_id" uuid,
	"payment_method" varchar(50) NOT NULL,
	"amount_cents" integer NOT NULL,
	"operator_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_debits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"comanda_id" uuid,
	"amount_cents" integer NOT NULL,
	"paid_cents" integer DEFAULT 0 NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"operator_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_points_balance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_points_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"amount_points" integer NOT NULL,
	"transaction_type" varchar(30) NOT NULL,
	"reference_id" uuid,
	"description" text,
	"operator_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "points_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"earn_rate_cents_per_point" integer DEFAULT 100 NOT NULL,
	"redemption_points_per_real" integer DEFAULT 100 NOT NULL,
	"max_redemption_percentage" integer DEFAULT 50 NOT NULL,
	"allowed_participants" varchar(30) DEFAULT 'all' NOT NULL,
	"expiration_days" integer DEFAULT 180 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_spaces_status_idx" ON "ad_spaces" ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_spaces_type_idx" ON "ad_spaces" ("tenant_id","space_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "advertisers_tenant_document_unique" ON "advertisers" ("tenant_id","document");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "advertisers_name_idx" ON "advertisers" ("tenant_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cash_closing_counts_tenant_session_idx" ON "cash_closing_counts" ("tenant_id","cash_session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cash_movements_tenant_session_idx" ON "cash_movements" ("tenant_id","cash_session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cash_sessions_tenant_status_idx" ON "cash_sessions" ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comanda_payments_tenant_comanda_idx" ON "comanda_payments" ("tenant_id","comanda_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comanda_payments_tenant_session_idx" ON "comanda_payments" ("tenant_id","cash_session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_debit_payments_tenant_debit_idx" ON "customer_debit_payments" ("tenant_id","customer_debit_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_debit_payments_tenant_session_idx" ON "customer_debit_payments" ("tenant_id","cash_session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_debits_tenant_customer_idx" ON "customer_debits" ("tenant_id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_points_balance_tenant_customer_unique" ON "customer_points_balance" ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_points_tx_tenant_customer_idx" ON "customer_points_transactions" ("tenant_id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "points_settings_tenant_unique" ON "points_settings" ("tenant_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ad_spaces" ADD CONSTRAINT "ad_spaces_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "advertisers" ADD CONSTRAINT "advertisers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cash_closing_counts" ADD CONSTRAINT "cash_closing_counts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cash_closing_counts" ADD CONSTRAINT "cash_closing_counts_cash_session_id_cash_sessions_id_fk" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_cash_session_id_cash_sessions_id_fk" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comanda_payments" ADD CONSTRAINT "comanda_payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comanda_payments" ADD CONSTRAINT "comanda_payments_comanda_id_comandas_id_fk" FOREIGN KEY ("comanda_id") REFERENCES "comandas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comanda_payments" ADD CONSTRAINT "comanda_payments_cash_session_id_cash_sessions_id_fk" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_debit_payments" ADD CONSTRAINT "customer_debit_payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_debit_payments" ADD CONSTRAINT "customer_debit_payments_customer_debit_id_customer_debits_id_fk" FOREIGN KEY ("customer_debit_id") REFERENCES "customer_debits"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_debit_payments" ADD CONSTRAINT "customer_debit_payments_cash_session_id_cash_sessions_id_fk" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_debits" ADD CONSTRAINT "customer_debits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_debits" ADD CONSTRAINT "customer_debits_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_debits" ADD CONSTRAINT "customer_debits_comanda_id_comandas_id_fk" FOREIGN KEY ("comanda_id") REFERENCES "comandas"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_points_balance" ADD CONSTRAINT "customer_points_balance_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_points_balance" ADD CONSTRAINT "customer_points_balance_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_points_transactions" ADD CONSTRAINT "customer_points_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_points_transactions" ADD CONSTRAINT "customer_points_transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "points_settings" ADD CONSTRAINT "points_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
