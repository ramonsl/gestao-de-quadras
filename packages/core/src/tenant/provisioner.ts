import { db, tenants } from "@gestao-de-quadras/db";
import { sql } from "drizzle-orm";
import { MODULES } from "../users/modules";

export interface ProvisionInput {
  slug: string;
  name: string;
  /** Admin inicial da arena (operador do tenant) */
  adminName: string;
  adminUsername: string;
  /** Hash argon2 já calculado — o provisioner nunca recebe senha em texto plano */
  adminPasswordHash: string;
  /** Opcional — a maioria dos operadores não possui e-mail */
  adminEmail?: string;
}

const SLUG_PATTERN = /^[a-z0-9-]+$/;

/**
 * Cria dinamicamente um novo schema de tenant no PostgreSQL e insere o
 * inquilino + o operador Admin inicial (dentro do próprio schema do tenant).
 *
 * Operadores são entidades DO tenant (SAAS-12): credenciais vivem em
 * `tenant_<slug>.users_tenants`, não no schema público.
 */
export async function provisionNewTenant(input: ProvisionInput) {
  if (!SLUG_PATTERN.test(input.slug)) {
    throw new Error(
      `Slug inválido: "${input.slug}". Use apenas letras minúsculas, números e hífen.`
    );
  }

  const schemaName = `tenant_${input.slug}`;
  const table = sql`${sql.identifier(schemaName)}.${sql.identifier("users_tenants")}`;
  const auditTable = sql`${sql.identifier(schemaName)}.${sql.identifier("audit_logs")}`;

  // 1. Cria o Tenant global no schema public
  await db.insert(tenants).values({
    slug: input.slug,
    name: input.name,
    status: "active",
  });

  // 2. Cria o schema físico do tenant — RNF-01: isolamento estrito
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS ${sql.identifier(schemaName)}`);

  // 3. Cria as tabelas do tenant (espelham tenant_template do schema.ts)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ${table} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
    )
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS ${sql.identifier(`users_tenants_username_unique_${input.slug}`)}
    ON ${table} ("username")
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ${auditTable} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL,
      "action" text NOT NULL,
      "details" text,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `);

  // 4. Insere o operador Admin inicial no schema do tenant (já ativo).
  //    Admin tem acesso irrestrito; modulesAllowed recebe todos os módulos.
  const allModules = JSON.stringify([...MODULES]);
  const [admin] = (
    await db.execute<{ id: string }>(sql`
      INSERT INTO ${table}
        ("username", "name", "email", "password_hash", "role", "modules_allowed", "status", "activated_at")
      VALUES (
        ${input.adminUsername},
        ${input.adminName},
        ${input.adminEmail ?? null},
        ${input.adminPasswordHash},
        'admin',
        ${allModules},
        'active',
        now()
      )
      RETURNING "id"
    `)
  ).rows as unknown as Array<{ id: string }>;

  return {
    tenantSlug: input.slug,
    adminUserId: admin.id,
    schemaName,
  };
}
