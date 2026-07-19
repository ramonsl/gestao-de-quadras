import { describe, it, expect, beforeAll } from "vitest";
import { provisionNewTenant } from "./provisioner";
import { db } from "@gestao-de-quadras/db";
import { sql } from "drizzle-orm";

describe("Provisionamento de Tenants (SAAS-01)", () => {
  const testSlug = `arena_${Date.now()}`;
  const adminEmail = `admin_${Date.now()}@arena.com`;

  beforeAll(async () => {
    // Garante que o schema public global de teste tem as tabelas estruturadas
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "tenants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "slug" varchar(50) NOT NULL UNIQUE,
        "name" varchar(100) NOT NULL,
        "status" varchar(20) DEFAULT 'active' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar(255) NOT NULL UNIQUE,
        "password_hash" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `);
  });

  it("deve provisionar um novo tenant com schema Postgres dedicado e admin inicial", async () => {
    const result = await provisionNewTenant({
      slug: testSlug,
      name: "Arena Teste Unitário",
      adminEmail,
      passwordHash: "fake_hash"
    });

    expect(result.tenantSlug).toBe(testSlug);
    expect(result.schemaName).toBe(`tenant_${testSlug}`);

    // Verifica se o schema foi criado fisicamente no Postgres
    const schemaCheck = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int as n 
      FROM information_schema.schemata 
      WHERE schema_name = ${result.schemaName}
    `);
    expect(schemaCheck[0].n).toBe(1);

    // Limpeza de testes locais
    await db.execute(sql.raw(`DROP SCHEMA IF EXISTS "${result.schemaName}" CASCADE`));
    await db.execute(sql`DELETE FROM "tenants" WHERE slug = ${testSlug}`);
    await db.execute(sql`DELETE FROM "users" WHERE id = ${result.adminUserId}`);
  });
});
