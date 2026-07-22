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
CREATE INDEX IF NOT EXISTS "customer_debits_tenant_customer_idx" ON "customer_debits" ("tenant_id","customer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_debit_payments_tenant_debit_idx" ON "customer_debit_payments" ("tenant_id","customer_debit_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_debit_payments_tenant_session_idx" ON "customer_debit_payments" ("tenant_id","cash_session_id");
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
