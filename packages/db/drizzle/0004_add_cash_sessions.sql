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
CREATE INDEX IF NOT EXISTS "cash_sessions_tenant_status_idx" ON "cash_sessions" ("tenant_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cash_movements_tenant_session_idx" ON "cash_movements" ("tenant_id","cash_session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cash_closing_counts_tenant_session_idx" ON "cash_closing_counts" ("tenant_id","cash_session_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
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
