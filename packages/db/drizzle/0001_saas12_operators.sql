-- SAAS-12: operadores passam a ser entidades DO tenant (self-contained).
-- users_tenants deixa de referenciar public.users e ganha credenciais próprias.
-- Aplica-se ao schema template; para os schemas de tenants já existentes use o
-- script `src/migrate-tenants-saas12.ts` (itera public.tenants).

ALTER TABLE "tenant_template"."users_tenants" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint
ALTER TABLE "tenant_template"."users_tenants" ADD COLUMN IF NOT EXISTS "username" varchar(50) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "tenant_template"."users_tenants" ADD COLUMN IF NOT EXISTS "name" varchar(120) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "tenant_template"."users_tenants" ADD COLUMN IF NOT EXISTS "email" varchar(255);--> statement-breakpoint
ALTER TABLE "tenant_template"."users_tenants" ADD COLUMN IF NOT EXISTS "phone" varchar(20);--> statement-breakpoint
ALTER TABLE "tenant_template"."users_tenants" ADD COLUMN IF NOT EXISTS "password_hash" text;--> statement-breakpoint
ALTER TABLE "tenant_template"."users_tenants" ADD COLUMN IF NOT EXISTS "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_template"."users_tenants" ADD COLUMN IF NOT EXISTS "activated_at" timestamp;--> statement-breakpoint
ALTER TABLE "tenant_template"."users_tenants" ADD COLUMN IF NOT EXISTS "activation_token" text;--> statement-breakpoint
ALTER TABLE "tenant_template"."users_tenants" ADD COLUMN IF NOT EXISTS "activation_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "tenant_template"."users_tenants" ADD COLUMN IF NOT EXISTS "reset_token" text;--> statement-breakpoint
ALTER TABLE "tenant_template"."users_tenants" ADD COLUMN IF NOT EXISTS "reset_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "tenant_template"."users_tenants" ADD COLUMN IF NOT EXISTS "failed_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_template"."users_tenants" ADD COLUMN IF NOT EXISTS "locked_until" timestamp;--> statement-breakpoint
ALTER TABLE "tenant_template"."users_tenants" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp;--> statement-breakpoint
ALTER TABLE "tenant_template"."users_tenants" ALTER COLUMN "username" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "tenant_template"."users_tenants" ALTER COLUMN "name" DROP DEFAULT;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_tenants_username_unique" ON "tenant_template"."users_tenants" ("username");
