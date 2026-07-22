ALTER TABLE "comanda_payments" ADD COLUMN IF NOT EXISTS "cash_session_id" uuid;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comanda_payments_tenant_session_idx" ON "comanda_payments" ("tenant_id","cash_session_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comanda_payments" ADD CONSTRAINT "comanda_payments_cash_session_id_cash_sessions_id_fk" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
