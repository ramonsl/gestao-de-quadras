CREATE TABLE IF NOT EXISTS "comanda_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"comanda_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name_at_sale" varchar(255) NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents_at_sale" integer NOT NULL,
	"operator_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comandas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"opened_by_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comanda_items_tenant_comanda_idx" ON "comanda_items" ("tenant_id","comanda_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comandas_tenant_status_idx" ON "comandas" ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comandas_tenant_customer_idx" ON "comandas" ("tenant_id","customer_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comanda_items" ADD CONSTRAINT "comanda_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comanda_items" ADD CONSTRAINT "comanda_items_comanda_id_comandas_id_fk" FOREIGN KEY ("comanda_id") REFERENCES "comandas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comandas" ADD CONSTRAINT "comandas_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
