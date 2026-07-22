-- PUB-01: Cadastro de Espaços Publicitários e Anunciantes (row-level, tenant_id)

CREATE TABLE IF NOT EXISTS "ad_spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"space_type" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'disponivel' NOT NULL,
	"reference_price_cents" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "advertisers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"document" varchar(14) NOT NULL,
	"email" varchar(255),
	"phone" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_spaces_status_idx" ON "ad_spaces" ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_spaces_type_idx" ON "ad_spaces" ("tenant_id","space_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "advertisers_tenant_document_unique" ON "advertisers" ("tenant_id","document");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "advertisers_name_idx" ON "advertisers" ("tenant_id","name");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ad_spaces" ADD CONSTRAINT "ad_spaces_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "advertisers" ADD CONSTRAINT "advertisers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
