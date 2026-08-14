CREATE TABLE IF NOT EXISTS "court_booking_splits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"court_booking_id" uuid NOT NULL,
	"comanda_id" uuid,
	"customer_id" uuid,
	"share_cents" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "court_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"court_id" uuid NOT NULL,
	"court_time_slot_id" uuid,
	"booking_date" date NOT NULL,
	"start_time_hhmm" varchar(5) NOT NULL,
	"end_time_hhmm" varchar(5) NOT NULL,
	"price_cents_at_booking" integer NOT NULL,
	"status" varchar(20) DEFAULT 'booked' NOT NULL,
	"comanda_id" uuid,
	"customer_id" uuid,
	"is_monthly" boolean DEFAULT false NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_print_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"paper_size" varchar(5) DEFAULT '80mm' NOT NULL,
	"auto_print_production_tickets" boolean DEFAULT false NOT NULL,
	"receipt_header" text,
	"receipt_footer" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comanda_items" ALTER COLUMN "product_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "comanda_items" ADD COLUMN "item_type" varchar(20) DEFAULT 'product' NOT NULL;--> statement-breakpoint
ALTER TABLE "comanda_items" ADD COLUMN "court_booking_id" uuid;--> statement-breakpoint
ALTER TABLE "court_time_slots" ADD COLUMN "monthly_price_in_cents" integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "court_booking_splits_booking_idx" ON "court_booking_splits" ("tenant_id","court_booking_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "court_booking_splits_comanda_idx" ON "court_booking_splits" ("tenant_id","comanda_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "court_bookings_no_double_idx" ON "court_bookings" ("tenant_id","court_id","booking_date","start_time_hhmm");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "court_bookings_tenant_date_idx" ON "court_bookings" ("tenant_id","booking_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "court_bookings_tenant_comanda_idx" ON "court_bookings" ("tenant_id","comanda_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_print_configs_tenant_unique" ON "tenant_print_configs" ("tenant_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "court_booking_splits" ADD CONSTRAINT "court_booking_splits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "court_booking_splits" ADD CONSTRAINT "court_booking_splits_comanda_id_comandas_id_fk" FOREIGN KEY ("comanda_id") REFERENCES "comandas"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "court_bookings" ADD CONSTRAINT "court_bookings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "court_bookings" ADD CONSTRAINT "court_bookings_comanda_id_comandas_id_fk" FOREIGN KEY ("comanda_id") REFERENCES "comandas"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tenant_print_configs" ADD CONSTRAINT "tenant_print_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
