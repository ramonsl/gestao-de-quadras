/**
 * Migração SAAS-12 para schemas de tenants JÁ existentes.
 *
 * Os schemas `tenant_<slug>` são criados imperativamente pelo provisioner, então
 * não são cobertos pelas migrations do drizzle. Este script itera
 * `public.tenants` e aplica as mesmas alterações de forma idempotente.
 *
 *   npx tsx src/migrate-tenants-saas12.ts
 */
import { db, tenants } from "./index";
import { sql } from "drizzle-orm";

const SLUG_PATTERN = /^[a-z0-9-]+$/;

async function migrateSchema(schemaName: string): Promise<void> {
  const t = sql`${sql.identifier(schemaName)}.${sql.identifier("users_tenants")}`;
  const statements = [
    sql`ALTER TABLE ${t} DROP COLUMN IF EXISTS "user_id"`,
    sql`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS "username" varchar(50) NOT NULL DEFAULT ''`,
    sql`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS "name" varchar(120) NOT NULL DEFAULT ''`,
    sql`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS "email" varchar(255)`,
    sql`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS "phone" varchar(20)`,
    sql`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS "password_hash" text`,
    sql`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS "must_change_password" boolean DEFAULT false NOT NULL`,
    sql`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS "activated_at" timestamp`,
    sql`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS "activation_token" text`,
    sql`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS "activation_token_expires_at" timestamp`,
    sql`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS "reset_token" text`,
    sql`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS "reset_token_expires_at" timestamp`,
    sql`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS "failed_attempts" integer DEFAULT 0 NOT NULL`,
    sql`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS "locked_until" timestamp`,
    sql`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS "last_login_at" timestamp`,
    sql`ALTER TABLE ${t} ALTER COLUMN "username" DROP DEFAULT`,
    sql`ALTER TABLE ${t} ALTER COLUMN "name" DROP DEFAULT`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS ${sql.identifier("users_tenants_username_unique")} ON ${t} ("username")`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS ${sql.identifier("users_tenants_email_unique")} ON ${t} ("email") WHERE "email" IS NOT NULL`,
  ];
  for (const stmt of statements) {
    await db.execute(stmt);
  }
}

async function main() {
  const rows = await db.select({ slug: tenants.slug }).from(tenants);
  console.log(`Migrando ${rows.length} tenant(s)…`);
  for (const { slug } of rows) {
    if (!SLUG_PATTERN.test(slug)) {
      console.warn(`  ! slug inválido ignorado: ${slug}`);
      continue;
    }
    const schemaName = `tenant_${slug}`;
    await migrateSchema(schemaName);
    console.log(`  ✓ ${schemaName}`);
  }
  console.log("Concluído.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
