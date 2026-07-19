import { db, tenants, users } from "@gestao-de-quadras/db";
import { sql } from "drizzle-orm";

export interface ProvisionInput {
  slug: string;
  name: string;
  adminEmail: string;
  passwordHash: string;
}

/**
 * Cria dinamicamente um novo schema de tenant no PostgreSQL
 * e insere o inquilino + usuário Admin inicial.
 */
export async function provisionNewTenant(input: ProvisionInput) {
  const schemaName = `tenant_${input.slug}`;

  // 1. Cria o Tenant global no schema public
  await db.insert(tenants).values({
    slug: input.slug,
    name: input.name,
    status: "active"
  });

  // 2. Garante o usuário global
  let user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, input.adminEmail)
  });

  if (!user) {
    const inserted = await db.insert(users).values({
      email: input.adminEmail,
      passwordHash: input.passwordHash,
      activatedAt: new Date(),
    }).returning();
    user = inserted[0];
  }

  // 3. Executa a criação física do schema no banco de dados
  // RNF-01: Isolamento estrito de dados por schema dedicado
  await db.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`));

  // 4. Executa a criação física das tabelas no novo schema
  // Como estamos no Neon PostgreSQL, as tabelas do template do tenant devem ser criadas
  // dentro do schema criado. No v1, criamos de forma imperativa:
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS "${schemaName}"."users_tenants" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL,
      "role" varchar(20) NOT NULL,
      "modules_allowed" text DEFAULT '[]' NOT NULL,
      "status" varchar(20) DEFAULT 'active' NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );
  `));

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS "${schemaName}"."audit_logs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL,
      "action" text NOT NULL,
      "details" text,
      "created_at" timestamp DEFAULT now() NOT NULL
    );
  `));

  // 5. Cadastra o vínculo de administrador do usuário no schema do tenant
  // Admin possui acesso a todos os módulos por padrão
  const allModules = JSON.stringify(['pdv', 'quadras', 'crm', 'filiacao', 'pontos', 'publicidade', 'relatorios', 'whatsapp', 'configuracoes']);
  await db.execute(sql.raw(`
    INSERT INTO "${schemaName}"."users_tenants" (user_id, role, modules_allowed, status)
    VALUES ('${user.id}', 'admin', '${allModules}', 'active');
  `));

  return {
    tenantSlug: input.slug,
    adminUserId: user.id,
    schemaName
  };
}
