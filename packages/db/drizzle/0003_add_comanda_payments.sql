CREATE TABLE IF NOT EXISTS "comanda_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"comanda_id" uuid NOT NULL,
	"payment_method" varchar(50) NOT NULL,
	"amount_cents" integer NOT NULL,
	"received_cents" integer,
	"change_cents" integer DEFAULT 0 NOT NULL,
	"operator_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
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
CREATE INDEX IF NOT EXISTS "comanda_payments_tenant_comanda_idx" ON "comanda_payments" ("tenant_id","comanda_id");
