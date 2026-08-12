-- PDV-05: Grade Visual de Locação de Quadras (row-level, tenant_id)
-- Cria a tabela de locação (court_bookings) com índice único parcial
-- anti-dupla-marcação, e adapta comanda_items para registrar a locação como
-- linha de comanda (snapshot de nome/preço — regras 6 e 10 do CLAUDE.md).

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
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "court_bookings" ADD CONSTRAINT "court_bookings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "court_bookings" ADD CONSTRAINT "court_bookings_comanda_id_comandas_id_fk" FOREIGN KEY ("comanda_id") REFERENCES "comandas"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
-- Guarda RÍGIDA anti-dupla-marcação (AC4): uma marcação ativa por quadra/dia/horário na arena.
CREATE UNIQUE INDEX IF NOT EXISTS "court_bookings_no_double_idx" ON "court_bookings" ("tenant_id","court_id","booking_date","start_time_hhmm") WHERE status <> 'cancelled';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "court_bookings_tenant_date_idx" ON "court_bookings" ("tenant_id","booking_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "court_bookings_tenant_comanda_idx" ON "court_bookings" ("tenant_id","comanda_id");
--> statement-breakpoint
-- comanda_items: suportar locação de quadra além de produto.
ALTER TABLE "comanda_items" ALTER COLUMN "product_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "comanda_items" ADD COLUMN IF NOT EXISTS "item_type" varchar(20) DEFAULT 'product' NOT NULL;
--> statement-breakpoint
ALTER TABLE "comanda_items" ADD COLUMN IF NOT EXISTS "court_booking_id" uuid;
