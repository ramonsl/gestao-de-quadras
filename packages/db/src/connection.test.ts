import { describe, it, expect, vi } from "vitest";
import { resolveTenantSchemaName, getTenantDb } from "./connection";

describe("Isolamento de Tenant e getTenantDb (packages/db)", () => {
  describe("resolveTenantSchemaName", () => {
    it("converte slug simples para o nome de schema físico 'tenant_<slug>'", () => {
      expect(resolveTenantSchemaName("arena-alpha")).toBe("tenant_arena-alpha");
      expect(resolveTenantSchemaName("quadra123")).toBe("tenant_quadra123");
    });

    it("mantém a string inalterada se já contiver o prefixo 'tenant_'", () => {
      expect(resolveTenantSchemaName("tenant_arena-beta")).toBe("tenant_arena-beta");
    });

    it("rejeita slugs nulos, vazios ou com caracteres de injeção SQL", () => {
      expect(() => resolveTenantSchemaName("")).toThrow("obrigatório");
      expect(() => resolveTenantSchemaName("   ")).toThrow("inválido");
      expect(() => resolveTenantSchemaName("arena; DROP TABLE users;--")).toThrow("inválido");
      expect(() => resolveTenantSchemaName("arena' OR '1'='1")).toThrow("inválido");
      expect(() => resolveTenantSchemaName("arena$test")).toThrow("inválido");
    });
  });

  describe("getTenantDb", () => {
    it("retorna um TenantDbClient configurado com o schemaName correto", () => {
      const tenantClient = getTenantDb("arena-central");
      expect(tenantClient.schemaName).toBe("tenant_arena-central");
      expect(typeof tenantClient.executeInTenant).toBe("function");
    });

    it("executa SET LOCAL search_path dentro da transação em executeInTenant", async () => {
      const tenantClient = getTenantDb("arena-test");

      // Mock da transação Drizzle
      const mockExecute = vi.fn().mockResolvedValue({ rows: [] });
      const mockTx = { execute: mockExecute };

      vi.spyOn(tenantClient.db, "transaction").mockImplementation(async (callback) => {
        return callback(mockTx as any);
      });

      const result = await tenantClient.executeInTenant(async (tx) => {
        await tx.execute("SELECT 1" as any);
        return "sucesso";
      });

      expect(result).toBe("sucesso");
      // Deve ter executado o SET LOCAL search_path com o schema do tenant em primeiro lugar
      const firstCallArg = mockExecute.mock.calls[0][0];
      expect(firstCallArg.queryChunks[0].value[0]).toContain('SET LOCAL search_path = "tenant_arena-test", public');
    });

    it("garante que o tenant A e o tenant B possuem schemas totalmente isolados", () => {
      const clientA = getTenantDb("arena-a");
      const clientB = getTenantDb("arena-b");

      expect(clientA.schemaName).toBe("tenant_arena-a");
      expect(clientB.schemaName).toBe("tenant_arena-b");
      expect(clientA.schemaName).not.toBe(clientB.schemaName);
    });

    it("impede que o tenant A acesse dados do tenant B através de escopos de transação separados", async () => {
      const clientA = getTenantDb("arena-a");
      const clientB = getTenantDb("arena-b");

      const searchPathsExecuted: string[] = [];

      // Intercepta execuções de transação
      vi.spyOn(clientA.db, "transaction").mockImplementation(async (cb) => {
        const mockTx = {
          execute: vi.fn().mockImplementation((queryObj) => {
            const sqlText = queryObj?.queryChunks?.[0]?.value?.[0] ?? "";
            if (sqlText.includes("SET LOCAL search_path")) {
              searchPathsExecuted.push(sqlText);
            }
            return Promise.resolve({ rows: [] });
          }),
        };
        return cb(mockTx as any);
      });

      await clientA.executeInTenant(async (tx) => {
        await tx.execute("SELECT * FROM users_tenants" as any);
      });

      await clientB.executeInTenant(async (tx) => {
        await tx.execute("SELECT * FROM users_tenants" as any);
      });

      expect(searchPathsExecuted).toHaveLength(2);
      expect(searchPathsExecuted[0]).toContain('SET LOCAL search_path = "tenant_arena-a", public');
      expect(searchPathsExecuted[1]).toContain('SET LOCAL search_path = "tenant_arena-b", public');
    });
  });
});
