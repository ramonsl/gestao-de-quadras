-- CAD-05: Tarifa Mensalista na grade de horários
-- Adiciona campo opcional para preço diferenciado de mensalistas
-- (Tarifa Avulsa = price_in_cents, Tarifa Mensalista = monthly_price_in_cents)
--
-- PDV-05: Rateio de Locação entre Múltiplas Comandas
-- Cria tabela court_booking_splits para registrar as N parcelas de rateio,
-- uma por comanda participante. A locação principal (court_bookings) continua
-- existindo como registro único da ocupação da quadra (anti-double-booking).

-- 1. Tarifa Mensalista na tabela de faixas horárias
ALTER TABLE "court_time_slots"
  ADD COLUMN IF NOT EXISTS "monthly_price_in_cents" integer;
--> statement-breakpoint

-- 2. Rateio: tabela de splits (parcelas do rateio entre comandas)
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

DO $$ BEGIN
  ALTER TABLE "court_booking_splits"
    ADD CONSTRAINT "court_booking_splits_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "court_booking_splits"
    ADD CONSTRAINT "court_booking_splits_court_booking_id_fk"
    FOREIGN KEY ("court_booking_id") REFERENCES "court_bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "court_booking_splits"
    ADD CONSTRAINT "court_booking_splits_comanda_id_fk"
    FOREIGN KEY ("comanda_id") REFERENCES "comandas"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "court_booking_splits_booking_idx"
  ON "court_booking_splits" ("tenant_id", "court_booking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "court_booking_splits_comanda_idx"
  ON "court_booking_splits" ("tenant_id", "comanda_id");
