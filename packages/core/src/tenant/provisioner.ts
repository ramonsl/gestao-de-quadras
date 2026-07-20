import { db, tenants } from "@gestao-de-quadras/db";
import { sql } from "drizzle-orm";
import { rows } from "../db/tenant";
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
 * Provisiona uma nova arena (modelo row-level): insere a linha em `tenants` e o
 * operador Admin inicial em `users_tenants` (com `tenant_id`). Sem CREATE SCHEMA
 * — as tabelas já existem no schema único `public` (ver Regra inviolável #1).
 */
export async function provisionNewTenant(input: ProvisionInput) {
  if (!SLUG_PATTERN.test(input.slug)) {
    throw new Error(
      `Slug inválido: "${input.slug}". Use apenas letras minúsculas, números e hífen.`
    );
  }

  // 1. Cria o Tenant e obtém seu id
  const [tenant] = await db
    .insert(tenants)
    .values({ slug: input.slug, name: input.name, status: "active" })
    .returning({ id: tenants.id });

  // 2. Insere o operador Admin inicial (já ativo, acesso irrestrito)
  const allModules = JSON.stringify([...MODULES]);
  const inserted = await db.execute<{ id: string }>(
    sql`INSERT INTO users_tenants
          (tenant_id, username, name, email, password_hash, role, modules_allowed, status, activated_at)
        VALUES (${tenant.id}, ${input.adminUsername}, ${input.adminName}, ${input.adminEmail ?? null},
                ${input.adminPasswordHash}, 'admin', ${allModules}, 'active', now())
        RETURNING id`
  );
  const adminUserId = rows<{ id: string }>(inserted)[0].id;

  return {
    tenantSlug: input.slug,
    tenantId: tenant.id,
    adminUserId,
  };
}
