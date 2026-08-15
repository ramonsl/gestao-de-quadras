CREATE TABLE IF NOT EXISTS "class_debit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"student_class_balance_id" uuid NOT NULL,
	"debited_by_user_id" uuid NOT NULL,
	"debited_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whatsapp_message_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"comanda_id" uuid,
	"to_e164" varchar(20) NOT NULL,
	"body_text" text NOT NULL,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"provider_message_id" varchar(255),
	"sent_at" timestamp,
	"error_description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX IF EXISTS "student_class_balance_global_customer_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "student_class_balance_class_package_id_idx";--> statement-breakpoint
ALTER TABLE "comanda_items" ADD COLUMN "class_package_id" uuid;--> statement-breakpoint
ALTER TABLE "comanda_items" ADD COLUMN "class_count_at_sale" integer;--> statement-breakpoint
ALTER TABLE "customer_opt_in_lgpd" ADD COLUMN "channel" varchar(20);--> statement-breakpoint
ALTER TABLE "student_class_balance" ADD COLUMN "comanda_item_id" uuid NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "class_debit_log_tenant_balance_idx" ON "class_debit_log" ("tenant_id","student_class_balance_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whatsapp_msg_log_tenant_customer_idx" ON "whatsapp_message_log" ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whatsapp_msg_log_tenant_status_idx" ON "whatsapp_message_log" ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_class_balance_tenant_customer_idx" ON "student_class_balance" ("tenant_id","global_customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_class_balance_tenant_package_idx" ON "student_class_balance" ("tenant_id","class_package_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "student_class_balance_comanda_item_uniq" ON "student_class_balance" ("tenant_id","comanda_item_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "class_debit_log" ADD CONSTRAINT "class_debit_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "whatsapp_message_log" ADD CONSTRAINT "whatsapp_message_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
