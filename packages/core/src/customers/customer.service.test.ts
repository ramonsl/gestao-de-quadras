import { describe, it, expect, vi } from "vitest";
import type { TenantContext } from "../db/tenant";
import {
  WhatsappSchema,
  findOrCreateGlobalCustomer,
  createGlobalCustomer,
  createCustomerInTenant,
  searchCustomersForPdv,
  setCustomerOptIn,
  quickCreateCustomerForPdv,
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

/**
 * Mock em FILA: cada chamada a `.execute()` consome a próxima resposta, na
 * ordem em que as chamadas acontecem. `mkDb`/`mkCtx` (acima) bastam quando a
 * função só faz 1 consulta — mas `quickCreateCustomerForPdv` encadeia várias
 * (busca local → busca/cria global → cria local → opt-in → auditoria) e cada
 * uma chama `.execute()` com um resultado diferente. Também guarda as queries
 * recebidas em `executedQueries`, para os poucos casos em que precisamos
 * confirmar O QUE foi enviado à query (não só o que ela devolveu) — ex.: "os
 * dados do GLOBAL prevalecem sobre o texto divergente do formulário".
 */
function mkQueueCtx(responseQueue: unknown[][], overrides: Partial<TenantContext> = {}) {
  const queue = [...responseQueue];
  const executedQueries: unknown[] = [];
  const db = {
    execute: async (query: unknown) => {
      executedQueries.push(query);
      if (queue.length === 0) {
        throw new Error(
          `mkQueueCtx: fila esgotada na chamada #${executedQueries.length} a .execute() — ` +
            "o teste não previu esta chamada."
        );
      }
      return { rows: queue.shift() };
    },
  };
  const ctx: TenantContext = {
    db: db as unknown as TenantContext["db"],
    tenantId: "11111111-1111-1111-1111-111111111111",
    actorUserId: "operador-1",
    ...overrides,
  };
  return { ctx, executedQueries };
}

function makeGlobalRow(
  overrides: Partial<{
    id: string;
    whatsapp: string;
    name: string;
    email: string | null;
    birth_date: string | null;
    photo_url: string | null;
    created_at: Date;
    updated_at: Date;
  }> = {}
) {
  return {
    id: "aaaaaaaa-0000-4000-8000-000000000000",
    whatsapp: "+5511999999999",
    name: "Cliente Global",
    email: null,
    birth_date: null,
    photo_url: null,
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makeLocalRow(
  overrides: Partial<{
    id: string;
    tenant_id: string;
    global_customer_id: string | null;
    whatsapp: string;
    name: string;
    email: string | null;
    birth_date: string | null;
    status: string;
    created_by_user_id: string;
    created_at: Date;
    updated_at: Date;
  }> = {}
) {
  return {
    id: "bbbbbbbb-0000-4000-8000-000000000000",
    tenant_id: "11111111-1111-1111-1111-111111111111",
    global_customer_id: null,
    whatsapp: "+5511999999999",
    name: "Cliente Local",
    email: null,
    birth_date: null,
    status: "active",
    created_by_user_id: "operador-1",
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

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

  describe("setCustomerOptIn (CAD-01 / PDV-02)", () => {
    it("recusa (guarda IDOR) quando getCustomerById não encontra o cliente neste tenant", async () => {
      const { ctx } = mkQueueCtx([
        [], // 1. getCustomerById (guarda IDOR): nenhuma linha — não é deste tenant
      ]);

      await expect(
        setCustomerOptIn(ctx, { customerId: "33333333-3333-3333-3333-333333333333", optIn: true })
      ).rejects.toThrow(/não encontrado/);
    });

    it("grava opt-in=true e também registra auditoria quando há ctx.actorUserId", async () => {
      const executeSpy = vi.fn(async () => ({ rows: [{}] }));
      const ctx: TenantContext = {
        db: { execute: executeSpy } as unknown as TenantContext["db"],
        tenantId: "11111111-1111-1111-1111-111111111111",
        actorUserId: "operador-1",
      };

      await setCustomerOptIn(ctx, { customerId: "33333333-3333-3333-3333-333333333333", optIn: true });

      // 1 chamada para a guarda IDOR (getCustomerById) + 1 para o UPSERT do
      // opt-in + 1 para o INSERT do log de auditoria.
      expect(executeSpy).toHaveBeenCalledTimes(3);
    });

    it("grava opt-in=false sem lançar erro", async () => {
      const ctx = mkCtx([{}]);

      await expect(
        setCustomerOptIn(ctx, { customerId: "33333333-3333-3333-3333-333333333333", optIn: false })
      ).resolves.toBeUndefined();
    });

    it("sem ctx.actorUserId grava só o opt-in, sem tentar registrar auditoria", async () => {
      const executeSpy = vi.fn(async () => ({ rows: [{}] }));
      const ctx: TenantContext = {
        db: { execute: executeSpy } as unknown as TenantContext["db"],
        tenantId: "11111111-1111-1111-1111-111111111111",
      };

      await setCustomerOptIn(ctx, { customerId: "33333333-3333-3333-3333-333333333333", optIn: true });

      // 1 chamada para a guarda IDOR (getCustomerById) + 1 para o UPSERT (sem auditoria).
      expect(executeSpy).toHaveBeenCalledTimes(2);
    });

    it("é idempotente — chamar de novo com o mesmo valor não lança erro (ON CONFLICT)", async () => {
      const ctx = mkCtx([{}]);
      const input = { customerId: "33333333-3333-3333-3333-333333333333", optIn: true };

      await setCustomerOptIn(ctx, input);
      await expect(setCustomerOptIn(ctx, input)).resolves.toBeUndefined();
    });

    it("rejeita customerId que não é um UUID válido", async () => {
      const ctx = mkCtx([{}]);

      await expect(setCustomerOptIn(ctx, { customerId: "nao-e-uuid", optIn: true })).rejects.toThrow();
    });
  });

  describe("quickCreateCustomerForPdv (PDV-02 — cadastro rápido inline)", () => {
    it("WhatsApp inédito: cria o registro global E o local, sem reaproveitar nada", async () => {
      const { ctx } = mkQueueCtx([
        [], // 1. searchCustomersForPdv: nenhum cliente local com esse whatsapp
        [], // 2. findOrCreateGlobalCustomer: ainda não existe global
        [makeGlobalRow({ id: "aaaaaaaa-2222-4222-8222-222222222222", whatsapp: "+5511988887777", name: "Cliente Novo" })], // 3. createGlobalCustomer INSERT
        [
          makeLocalRow({
            id: "bbbbbbbb-2222-4222-8222-222222222222",
            global_customer_id: "aaaaaaaa-2222-4222-8222-222222222222",
            whatsapp: "+5511988887777",
            name: "Cliente Novo",
          }),
        ], // 4. createCustomerInTenant INSERT
        [makeLocalRow({ id: "bbbbbbbb-2222-4222-8222-222222222222" })], // 5. setCustomerOptIn -> getCustomerById (guarda IDOR)
        [{}], // 6. setCustomerOptIn upsert
        [{}], // 7. setCustomerOptIn -> writeAudit
        [{}], // 8. writeAudit do próprio quickCreateCustomerForPdv
      ]);

      const result = await quickCreateCustomerForPdv(ctx, {
        whatsapp: "+5511988887777",
        name: "Cliente Novo",
        optInLgpd: true,
      });

      expect(result.success).toBe(true);
      if (!result.success) throw new Error("esperava sucesso");
      expect(result.reusedExistingLocal).toBe(false);
      expect(result.globalCustomerFound).toBe(false);
      expect(result.customer.globalCustomerId).toBe("aaaaaaaa-2222-4222-8222-222222222222");
    });

    it("WhatsApp já em global_customers (de outra arena): reaproveita nome/e-mail/nascimento do GLOBAL, ignorando o texto divergente do formulário", async () => {
      const globalRow = makeGlobalRow({
        id: "aaaaaaaa-3333-4333-8333-333333333333",
        whatsapp: "+5511977776666",
        name: "Nome Cadastrado Na Outra Arena",
        email: "real@outraarena.com",
        birth_date: "1990-05-20",
      });
      const { ctx, executedQueries } = mkQueueCtx([
        [], // 1. searchCustomersForPdv: sem cliente local NESTE tenant
        [globalRow], // 2. findOrCreateGlobalCustomer: encontrado (found=true)
        // (createGlobalCustomer NÃO é chamado — o global já existia)
        [
          makeLocalRow({
            id: "bbbbbbbb-3333-4333-8333-333333333333",
            global_customer_id: "aaaaaaaa-3333-4333-8333-333333333333",
            whatsapp: "+5511977776666",
            name: "Nome Cadastrado Na Outra Arena",
            email: "real@outraarena.com",
            birth_date: "1990-05-20",
          }),
        ], // 3. createCustomerInTenant INSERT
        [makeLocalRow({ id: "bbbbbbbb-3333-4333-8333-333333333333" })], // 4. setCustomerOptIn -> getCustomerById (guarda IDOR)
        [{}], // 5. setCustomerOptIn upsert
        [{}], // 6. setCustomerOptIn -> writeAudit
        [{}], // 7. writeAudit do próprio quickCreateCustomerForPdv
      ]);

      const result = await quickCreateCustomerForPdv(ctx, {
        whatsapp: "+5511977776666",
        name: "Nome Errado Digitado Agora", // operador digita algo diferente do que já existe no global
        optInLgpd: false,
      });

      expect(result.success).toBe(true);
      if (!result.success) throw new Error("esperava sucesso");
      expect(result.globalCustomerFound).toBe(true);
      expect(result.reusedExistingLocal).toBe(false);
      expect(result.customer.name).toBe("Nome Cadastrado Na Outra Arena");
      expect(result.customer.email).toBe("real@outraarena.com");

      // Confirma o que foi de fato ENVIADO ao INSERT de createCustomerInTenant
      // (chamada #3, índice 2) — não só o que o mock devolveu de volta.
      const insertCustomerQuery = JSON.stringify(executedQueries[2]);
      expect(insertCustomerQuery).toContain("Nome Cadastrado Na Outra Arena");
      expect(insertCustomerQuery).toContain("real@outraarena.com");
      expect(insertCustomerQuery).not.toContain("Nome Errado Digitado Agora");
    });

    it("WhatsApp já é cliente local neste tenant: reaproveita sem duplicar (reusedExistingLocal)", async () => {
      const existingLocal = makeLocalRow({
        id: "bbbbbbbb-4444-4444-8444-444444444444",
        whatsapp: "+5511966665555",
        name: "Já Cadastrado",
      });
      const { ctx, executedQueries } = mkQueueCtx([
        [existingLocal], // 1. searchCustomersForPdv encontra o cliente local
        [existingLocal], // 2. setCustomerOptIn -> getCustomerById (guarda IDOR)
        [{}], // 3. setCustomerOptIn upsert
        [{}], // 4. setCustomerOptIn -> writeAudit
      ]);

      const result = await quickCreateCustomerForPdv(ctx, {
        whatsapp: "+5511966665555",
        name: "Nome Digitado De Novo Por Engano",
        optInLgpd: true,
      });

      expect(result.success).toBe(true);
      if (!result.success) throw new Error("esperava sucesso");
      expect(result.reusedExistingLocal).toBe(true);
      expect(result.globalCustomerFound).toBe(false);
      expect(result.customer.id).toBe("bbbbbbbb-4444-4444-8444-444444444444");
      // nenhuma consulta a global_customers nem INSERT novo — só as 4 chamadas acima
      expect(executedQueries).toHaveLength(4);
    });

    it("validação: rejeita nome vazio (success:false, reason:'validation')", async () => {
      const { ctx } = mkQueueCtx([]); // nenhuma chamada ao banco deve acontecer

      const result = await quickCreateCustomerForPdv(ctx, {
        whatsapp: "+5511999999999",
        name: "",
        optInLgpd: false,
      });

      expect(result.success).toBe(false);
      if (result.success) throw new Error("esperava falha de validação");
      expect(result.reason).toBe("validation");
      expect(result.errors.name).toBeDefined();
    });

    it("validação: rejeita WhatsApp em formato inválido (success:false, reason:'validation')", async () => {
      const { ctx } = mkQueueCtx([]);

      const result = await quickCreateCustomerForPdv(ctx, {
        whatsapp: "11999999999", // sem "+", formato estrutural inválido
        name: "Alguém",
        optInLgpd: false,
      });

      expect(result.success).toBe(false);
      if (result.success) throw new Error("esperava falha de validação");
      expect(result.reason).toBe("validation");
      expect(result.errors.whatsapp).toBeDefined();
    });

    it("lança erro claro quando ctx.actorUserId está ausente", async () => {
      const { ctx } = mkQueueCtx([], { actorUserId: undefined });

      await expect(
        quickCreateCustomerForPdv(ctx, { whatsapp: "+5511999999999", name: "Alguém", optInLgpd: false })
      ).rejects.toThrow(/actorUserId/);
    });
  });
});
