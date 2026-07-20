import { describe, it, expect } from "vitest";
import {
  WhatsappSchema,
  findOrCreateGlobalCustomer,
  createGlobalCustomer,
  createCustomerInTenant,
  searchCustomersForPdv,
} from "./customer.service";

/**
 * Mock do handle Drizzle (`.execute`) usado no Mecanismo A (SQL cru).
 * As linhas vêm em snake_case, como o Postgres retorna.
 */
const mkDb = (returnedRows: unknown[]) =>
  ({ execute: async () => ({ rows: returnedRows }) }) as any;

/** Contexto de tenant com um schema válido. */
const mkCtx = (returnedRows: unknown[]) =>
  ({ db: mkDb(returnedRows), tenantId: "11111111-1111-1111-1111-111111111111" }) as any;

describe("Customer Service", () => {
  describe("WhatsappSchema Validation", () => {
    it("aceita WhatsApp válido Brasil +55", () => {
      expect(() => WhatsappSchema.parse("+5511999999999")).not.toThrow();
    });

    it("aceita WhatsApp válido Portugal +351", () => {
      expect(() => WhatsappSchema.parse("+351912345678")).not.toThrow();
    });

    it("rejeita WhatsApp sem prefixo +", () => {
      expect(() => WhatsappSchema.parse("5511999999999")).toThrow();
    });

    it("rejeita WhatsApp com formato inválido", () => {
      expect(() => WhatsappSchema.parse("+55 11 9999-9999")).toThrow();
    });

    it("rejeita WhatsApp vazio", () => {
      expect(() => WhatsappSchema.parse("")).toThrow();
    });

    it("rejeita número muito curto", () => {
      expect(() => WhatsappSchema.parse("+55119")).toThrow();
    });
  });

  describe("findOrCreateGlobalCustomer", () => {
    it("retorna found=false quando cliente não existe", async () => {
      const result = await findOrCreateGlobalCustomer(mkDb([]), "+5511999999999");
      expect(result.found).toBe(false);
    });

    it("retorna found=true quando cliente existe", async () => {
      const db = mkDb([
        {
          id: "cust-1",
          whatsapp: "+5511999999999",
          name: "João",
          email: "joao@email.com",
          birth_date: null,
          photo_url: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
      const result = await findOrCreateGlobalCustomer(db, "+5511999999999");
      expect(result.found).toBe(true);
      expect(result.customer.name).toBe("João");
    });

    it("valida WhatsApp antes de buscar", async () => {
      await expect(
        findOrCreateGlobalCustomer(mkDb([]), "invalid-whatsapp")
      ).rejects.toThrow();
    });
  });

  describe("createGlobalCustomer", () => {
    it("cria cliente global com dados completos", async () => {
      const db = mkDb([
        {
          id: "global-1",
          whatsapp: "+5511999999999",
          name: "Maria Silva",
          email: "maria@email.com",
          birth_date: "1990-05-15",
          photo_url: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
      const result = await createGlobalCustomer(db, {
        whatsapp: "+5511999999999",
        name: "Maria Silva",
        email: "maria@email.com",
        birthDate: new Date("1990-05-15"),
      });
      expect(result.whatsapp).toBe("+5511999999999");
      expect(result.name).toBe("Maria Silva");
      expect(result.email).toBe("maria@email.com");
    });

    it("cria cliente sem email (opcional)", async () => {
      const db = mkDb([
        {
          id: "global-2",
          whatsapp: "+5511988888888",
          name: "Carlos",
          email: null,
          birth_date: null,
          photo_url: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
      const result = await createGlobalCustomer(db, {
        whatsapp: "+5511988888888",
        name: "Carlos",
      });
      expect(result.email).toBeNull();
      expect(result.birthDate).toBeNull();
    });
  });

  describe("createCustomerInTenant", () => {
    it("cria cliente local vinculado ao global", async () => {
      const ctx = mkCtx([
        {
          id: "local-1",
          global_customer_id: "global-1",
          whatsapp: "+5511999999999",
          name: "Maria Silva",
          email: "maria@email.com",
          birth_date: "1990-05-15",
          status: "active",
          created_by_user_id: "user-admin",
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
      const result = await createCustomerInTenant(ctx, {
        globalCustomerId: "global-1",
        whatsapp: "+5511999999999",
        name: "Maria Silva",
        email: "maria@email.com",
        birthDate: new Date("1990-05-15"),
        createdByUserId: "user-admin",
      });
      expect(result.globalCustomerId).toBe("global-1");
      expect(result.status).toBe("active");
      expect(result.createdByUserId).toBe("user-admin");
    });

    it("cria cliente local sem global (cliente novo na arena)", async () => {
      const ctx = mkCtx([
        {
          id: "local-2",
          global_customer_id: null,
          whatsapp: "+5511977777777",
          name: "Ana",
          email: null,
          birth_date: null,
          status: "active",
          created_by_user_id: "user-gerente",
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
      const result = await createCustomerInTenant(ctx, {
        whatsapp: "+5511977777777",
        name: "Ana",
        createdByUserId: "user-gerente",
      });
      expect(result.globalCustomerId).toBeNull();
      expect(result.status).toBe("active");
    });
  });

  describe("searchCustomersForPdv", () => {
    it("retorna lista vazia para query vazia", async () => {
      const result = await searchCustomersForPdv(mkCtx([]), "");
      expect(result).toEqual([]);
    });

    it("busca por nome parcial (case-insensitive)", async () => {
      const ctx = mkCtx([
        { id: "local-1", name: "Maria Silva", whatsapp: "+5511999999999" },
        { id: "local-2", name: "Mariana Costa", whatsapp: "+5511988888888" },
      ]);
      const result = await searchCustomersForPdv(ctx, "maria");
      expect(result.length).toBe(2);
      expect(result[0].name).toContain("Maria");
    });

    it("busca por WhatsApp exato (começa com +)", async () => {
      const ctx = mkCtx([
        { id: "local-1", name: "João", whatsapp: "+5511999999999" },
      ]);
      const result = await searchCustomersForPdv(ctx, "+5511999999999");
      expect(result.length).toBe(1);
      expect(result[0].whatsapp).toBe("+5511999999999");
    });

    it("não consulta o banco para query com menos de 2 caracteres", async () => {
      const result = await searchCustomersForPdv(mkCtx([]), "a");
      expect(result).toEqual([]);
    });
  });
});
