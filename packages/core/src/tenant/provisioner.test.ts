import { describe, it, expect, beforeAll } from "vitest";
import { provisionNewTenant } from "./provisioner";
import { db } from "@gestao-de-quadras/db";
import { sql } from "drizzle-orm";

/**
 * Teste de INTEGRAÇÃO — cria/derruba schemas físicos no Postgres, então só roda
 * quando um banco de teste é fornecido via TEST_DATABASE_URL. Sem essa variável,
 * a suíte é ignorada para não abrir conexão contra um banco real em `pnpm test`.
 *
 * Atualizado para o contrato SAAS-12 do provisioner: o operador Admin inicial é
 * uma entidade DO tenant (adminName/adminUsername/adminPasswordHash), não mais
 * um registro em public.users.
 */
const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasTestDb)("Provisionamento de Tenants (SAAS-01 / SAAS-12)", () => {
  const testSlug = `arena-${Date.now()}`;

  beforeAll(async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "tenants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "slug" varchar(50) NOT NULL UNIQUE,
        "name" varchar(100) NOT NULL,
        "status" varchar(20) DEFAULT 'active' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `);
  });

  it("provisiona um tenant com schema dedicado e Admin inicial no próprio schema", async () => {
    const result = await provisionNewTenant({
      slug: testSlug,
      name: "Arena Teste Unitário",
      adminName: "Admin Teste",
      adminUsername: "admin",
      adminPasswordHash: "fake_hash",
      adminEmail: `admin_${Date.now()}@arena.com`,
    });

    expect(result.tenantSlug).toBe(testSlug);
    expect(result.schemaName).toBe(`tenant_${testSlug}`);
    expect(result.adminUserId).toBeTruthy();

    const schemaCheck = await db.execute(sql`
      SELECT count(*)::int as n
      FROM information_schema.schemata
      WHERE schema_name = ${result.schemaName}
    `);
    const rows = (schemaCheck as { rows?: Array<{ n: number }> }).rows ?? (schemaCheck as unknown as Array<{ n: number }>);
    expect(rows[0].n).toBe(1);

    // o Admin inicial vive no schema do tenant (isolamento SAAS-12)
    const adminCheck = await db.execute(
      sql`SELECT username, role FROM ${sql.identifier(result.schemaName)}.${sql.identifier("users_tenants")} WHERE id = ${result.adminUserId}`
    );
    const adminRows = (adminCheck as { rows?: Array<{ username: string; role: string }> }).rows ?? [];
    expect(adminRows[0]).toMatchObject({ username: "admin", role: "admin" });

    // limpeza
    await db.execute(sql.raw(`DROP SCHEMA IF EXISTS "${result.schemaName}" CASCADE`));
    await db.execute(sql`DELETE FROM "tenants" WHERE slug = ${testSlug}`);
  });
});
