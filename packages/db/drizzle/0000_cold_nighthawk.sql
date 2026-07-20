CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "class_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"total_class_count" integer NOT NULL,
	"price_in_cents" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "court_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"court_id" uuid NOT NULL,
	"service_type" varchar(50) NOT NULL,
	"base_price_in_cents" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "court_time_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"court_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time_hhmm" varchar(5) NOT NULL,
	"end_time_hhmm" varchar(5) NOT NULL,
	"duration_minutes" integer NOT NULL,
	"price_in_cents" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "courts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"modality" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_opt_in_lgpd" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"opt_in" boolean DEFAULT false NOT NULL,
	"opt_in_at" timestamp,
	"opt_out_at" timestamp,
	"changed_by_user_id" uuid,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "global_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"whatsapp" varchar(15) NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(255),
	"birth_date" date,
	"photo_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "global_customers_whatsapp_unique" UNIQUE("whatsapp")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"barcode" varchar(100),
	"sale_price_cents" integer NOT NULL,
	"category" varchar(100) NOT NULL,
	"current_stock" integer DEFAULT 0 NOT NULL,
	"min_stock" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity_change" integer NOT NULL,
	"reason" varchar(50) NOT NULL,
	"user_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student_class_balance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"global_customer_id" uuid NOT NULL,
	"class_package_id" uuid NOT NULL,
	"remaining_classes" integer NOT NULL,
	"purchased_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text,
	"activated_at" timestamp,
	"activation_token" text,
	"activation_token_expires_at" timestamp,
	"reset_token" text,
	"reset_token_expires_at" timestamp,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users_tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
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
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_idx" ON "audit_logs" ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "class_packages_is_active_idx" ON "class_packages" ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "court_services_court_id_idx" ON "court_services" ("court_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "court_services_service_type_idx" ON "court_services" ("tenant_id","service_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "court_time_slots_court_id_idx" ON "court_time_slots" ("court_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "court_time_slots_day_of_week_idx" ON "court_time_slots" ("tenant_id","day_of_week");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courts_modality_idx" ON "courts" ("tenant_id","modality");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courts_is_active_idx" ON "courts" ("tenant_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_opt_in_lgpd_customer_id_unique" ON "customer_opt_in_lgpd" ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_opt_in_lgpd_opt_in_idx" ON "customer_opt_in_lgpd" ("tenant_id","opt_in");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customers_tenant_whatsapp_unique" ON "customers" ("tenant_id","whatsapp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_global_id_idx" ON "customers" ("tenant_id","global_customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_name_idx" ON "customers" ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "global_customers_whatsapp_unique" ON "global_customers" ("whatsapp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "global_customers_name_idx" ON "global_customers" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_barcode_idx" ON "products" ("tenant_id","barcode");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_category_idx" ON "products" ("tenant_id","category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_product_id_idx" ON "stock_movements" ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_class_balance_global_customer_id_idx" ON "student_class_balance" ("global_customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_class_balance_class_package_id_idx" ON "student_class_balance" ("class_package_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_tenants_username_unique" ON "users_tenants" ("tenant_id","username");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_tenants_email_unique" ON "users_tenants" ("tenant_id","email");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "class_packages" ADD CONSTRAINT "class_packages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "court_services" ADD CONSTRAINT "court_services_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "court_time_slots" ADD CONSTRAINT "court_time_slots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "courts" ADD CONSTRAINT "courts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_opt_in_lgpd" ADD CONSTRAINT "customer_opt_in_lgpd_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_class_balance" ADD CONSTRAINT "student_class_balance_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users_tenants" ADD CONSTRAINT "users_tenants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
