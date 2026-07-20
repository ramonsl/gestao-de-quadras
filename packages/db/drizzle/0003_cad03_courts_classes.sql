-- CAD-03: Cadastro de Quadras, Serviços e Aulas

CREATE TABLE IF NOT EXISTS "tenant_template"."courts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"modality" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courts_modality_idx" ON "tenant_template"."courts" ("modality");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courts_is_active_idx" ON "tenant_template"."courts" ("is_active");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_template"."court_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"court_id" uuid NOT NULL,
	"service_type" varchar(50) NOT NULL,
	"base_price_in_cents" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "court_services_court_id_idx" ON "tenant_template"."court_services" ("court_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "court_services_service_type_idx" ON "tenant_template"."court_services" ("service_type");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_template"."court_time_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
CREATE INDEX IF NOT EXISTS "court_time_slots_court_id_idx" ON "tenant_template"."court_time_slots" ("court_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "court_time_slots_day_of_week_idx" ON "tenant_template"."court_time_slots" ("day_of_week");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_template"."class_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"total_class_count" integer NOT NULL,
	"price_in_cents" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "class_packages_is_active_idx" ON "tenant_template"."class_packages" ("is_active");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_template"."student_class_balance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"global_customer_id" uuid NOT NULL,
	"class_package_id" uuid NOT NULL,
	"remaining_classes" integer NOT NULL,
	"purchased_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_class_balance_global_customer_id_idx" ON "tenant_template"."student_class_balance" ("global_customer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_class_balance_class_package_id_idx" ON "tenant_template"."student_class_balance" ("class_package_id");
