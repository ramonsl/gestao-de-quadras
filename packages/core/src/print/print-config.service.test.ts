import { describe, it, expect } from "vitest";
import {
  getPrintConfig,
  upsertPrintConfig,
  UpsertPrintConfigInputSchema,
} from "./print-config.service";

/**
 * CAD-07 — Configurações de Impressão Térmica do Tenant
 *
 * Contexto de tenant com `db.execute` sequencial: cada chamada consome o
 * próximo conjunto de linhas (snake_case, como o Postgres retorna).
 */
const ctx = (rowSets: unknown[][], opts: { actorUserId?: string } = {}) => {
  let i = 0;
  return {
    db: { execute: async () => ({ rows: rowSets[i++] ?? [] }) },
    tenantId: "11111111-1111-1111-1111-111111111111",
    actorUserId: opts.actorUserId ?? "user-1",
  } as any;
};

const configRow = (over: Record<string, unknown> = {}) => ({
  id: "cfg-1",
  tenant_id: "11111111-1111-1111-1111-111111111111",
  paper_size: "80mm",
  auto_print_production_tickets: false,
  receipt_header: null,
  receipt_footer: null,
  ...over,
});

describe("CAD-07 — PrintConfig Service", () => {
  // ────────────────────────────────────────────────────────────────────────────
  // assertTenantId
  // ────────────────────────────────────────────────────────────────────────────
  describe("assertTenantId", () => {
    it("AC7 — getPrintConfig lança para tenant_id malformado", async () => {
      await expect(
        getPrintConfig({ db: {} as any, tenantId: "nao-e-uuid" })
      ).rejects.toThrow(/tenant_id inválido/i);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // getPrintConfig
  // ────────────────────────────────────────────────────────────────────────────
  describe("getPrintConfig", () => {
    it("AC1 — retorna config default quando não há linha no banco", async () => {
      const result = await getPrintConfig(ctx([[]]));
      expect(result.paperSize).toBe("80mm");
      expect(result.autoPrintProductionTickets).toBe(false);
      expect(result.receiptHeader).toBeNull();
      expect(result.receiptFooter).toBeNull();
      expect(result.id).toBeUndefined();
    });

    it("AC2 — retorna valores salvos quando há linha no banco", async () => {
      const row = configRow({
        id: "cfg-42",
        paper_size: "58mm",
        auto_print_production_tickets: true,
        receipt_header: "Arena Padel SP",
        receipt_footer: "Obrigado pela preferência!",
      });
      const result = await getPrintConfig(ctx([[row]]));
      expect(result.id).toBe("cfg-42");
      expect(result.paperSize).toBe("58mm");
      expect(result.autoPrintProductionTickets).toBe(true);
      expect(result.receiptHeader).toBe("Arena Padel SP");
      expect(result.receiptFooter).toBe("Obrigado pela preferência!");
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // upsertPrintConfig
  // ────────────────────────────────────────────────────────────────────────────
  describe("upsertPrintConfig", () => {
    it("AC3 — insere nova linha corretamente", async () => {
      const returned = configRow({
        id: "cfg-new",
        paper_size: "58mm",
        auto_print_production_tickets: false,
      });
      const result = await upsertPrintConfig(ctx([[returned]]), {
        paperSize: "58mm",
        autoPrintProductionTickets: false,
        receiptHeader: null,
        receiptFooter: null,
      });
      expect(result.id).toBe("cfg-new");
      expect(result.paperSize).toBe("58mm");
    });

    it("AC4 — atualiza linha existente (idempotência com ON CONFLICT)", async () => {
      const firstVersion = configRow({ id: "cfg-1", paper_size: "80mm" });
      const updated = configRow({
        id: "cfg-1",
        paper_size: "58mm",
        receipt_header: "Header atualizado",
      });

      // Primeira gravação
      const first = await upsertPrintConfig(ctx([[firstVersion]]), {
        paperSize: "80mm",
        autoPrintProductionTickets: false,
        receiptHeader: null,
        receiptFooter: null,
      });
      expect(first.paperSize).toBe("80mm");

      // Segunda gravação (simula ON CONFLICT → retorna linha atualizada)
      const second = await upsertPrintConfig(ctx([[updated]]), {
        paperSize: "58mm",
        autoPrintProductionTickets: false,
        receiptHeader: "Header atualizado",
        receiptFooter: null,
      });
      expect(second.id).toBe("cfg-1"); // mesmo id
      expect(second.paperSize).toBe("58mm");
      expect(second.receiptHeader).toBe("Header atualizado");
    });

    it("AC5 — lança Error quando ctx.actorUserId está ausente", async () => {
      // Contexto explicitamente sem actorUserId (omitido, não com default)
      const noActorCtx = {
        db: { execute: async () => ({ rows: [] }) },
        tenantId: "11111111-1111-1111-1111-111111111111",
        // actorUserId propositalmente ausente
      } as any;
      await expect(
        upsertPrintConfig(noActorCtx, {
          paperSize: "80mm",
          autoPrintProductionTickets: false,
          receiptHeader: null,
          receiptFooter: null,
        })
      ).rejects.toThrow(/actorUserId/i);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // UpsertPrintConfigInputSchema — validação Zod
  // ────────────────────────────────────────────────────────────────────────────
  describe("UpsertPrintConfigInputSchema", () => {
    it("AC6 — rejeita paperSize inválido ('100mm')", () => {
      const result = UpsertPrintConfigInputSchema.safeParse({
        paperSize: "100mm",
        autoPrintProductionTickets: false,
        receiptHeader: null,
        receiptFooter: null,
      });
      expect(result.success).toBe(false);
    });

    it("AC6 — aceita '58mm' e '80mm'", () => {
      expect(
        UpsertPrintConfigInputSchema.safeParse({ paperSize: "58mm" }).success
      ).toBe(true);
      expect(
        UpsertPrintConfigInputSchema.safeParse({ paperSize: "80mm" }).success
      ).toBe(true);
    });

    it("AC6 — aplica default '80mm' quando paperSize não é fornecido", () => {
      const result = UpsertPrintConfigInputSchema.parse({});
      expect(result.paperSize).toBe("80mm");
      expect(result.autoPrintProductionTickets).toBe(false);
      expect(result.receiptHeader).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Isolamento de tenant (AC8)
  // ────────────────────────────────────────────────────────────────────────────
  describe("isolamento de tenant", () => {
    it("AC8 — salvar para tenant A não afeta a leitura do tenant B", async () => {
      const tenantA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
      const tenantB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

      const ctxA = {
        db: {
          execute: async () => ({
            rows: [
              configRow({ tenant_id: tenantA, paper_size: "58mm" }),
            ],
          }),
        },
        tenantId: tenantA,
        actorUserId: "user-a",
      } as any;

      // Tenant B sem linha → deve retornar default, não dados do tenant A
      const ctxBEmpty = {
        db: { execute: async () => ({ rows: [] }) },
        tenantId: tenantB,
        actorUserId: "user-b",
      } as any;

      await upsertPrintConfig(ctxA, {
        paperSize: "58mm",
        autoPrintProductionTickets: true,
        receiptHeader: "Arena A",
        receiptFooter: null,
      });

      const configB = await getPrintConfig(ctxBEmpty);

      // Tenant B deve ter defaults, não os dados do tenant A
      expect(configB.tenantId).toBe(tenantB);
      expect(configB.paperSize).toBe("80mm");
      expect(configB.autoPrintProductionTickets).toBe(false);
      expect(configB.receiptHeader).toBeNull();
    });
  });
});
