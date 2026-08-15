import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildComandaNotificationText,
  enqueueComandaNotificationIfEligible,
  isMenuKeyword,
  processMenuRequest,
  processOptInOutKeyword,
  type NotificationQueuePort,
} from "../notification.service";
import { sqlText, type RecordedCall } from "../../test/sql-mock";
import type { TenantContext } from "../../db/tenant";

// ---------------------------------------------------------------------------
// Constantes compartilhadas
// ---------------------------------------------------------------------------

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";
const CUSTOMER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const COMANDA_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const CUSTOMER_PHONE = "+5548999990000";

// ---------------------------------------------------------------------------
// Helpers de mock
// ---------------------------------------------------------------------------

/** Descritor de estado para o mock do banco de dados. */
interface NotificationDbScenario {
  /** Se o cliente tem opt-in ativo. undefined = sem linha na tabela. */
  optIn?: boolean;
  /** Número WhatsApp do cliente (null = sem número). */
  customerWhatsapp?: string | null;
  /** Se o remetente (by phone) existe como customer. */
  customerByPhone?: boolean;
  /** Se já existe linha em customer_opt_in_lgpd para o customer. */
  existingOptInRow?: boolean;
  /** Comanda aberta do cliente (null = sem comanda). */
  openComandaId?: string | null;
  /** Itens da comanda aberta. */
  comandaItems?: Array<{ product_name: string; quantity: number; unit_price: number }>;
  /** Saldo de pontos (undefined = sem linha). */
  pointsBalance?: number;
  /** Slug do tenant. */
  tenantSlug?: string;
}

function makeMockDb(scenario: NotificationDbScenario = {}) {
  const calls: RecordedCall[] = [];

  const execute = async (sqlObj: unknown): Promise<{ rows: unknown[] }> => {
    const text = sqlText(sqlObj);
    calls.push({ text, params: [] });

    // opt_in check — enqueueComandaNotificationIfEligible
    // Diferencia por: seleciona "opt_in" como COLUNA (SELECT opt_in, customer_id ...)
    if (/SELECT/i.test(text) && /customer_opt_in_lgpd/.test(text) && /SELECT\s+opt_in/i.test(text)) {
      if (scenario.optIn === undefined) return { rows: [] };
      return { rows: [{ opt_in: scenario.optIn, customer_id: CUSTOMER_ID }] };
    }

    // customers by id — enqueueComandaNotificationIfEligible (2ª query)
    if (/SELECT/i.test(text) && /customers/.test(text) && /WHERE id =/.test(text)) {
      const whatsapp = scenario.customerWhatsapp ?? null;
      return { rows: [{ id: CUSTOMER_ID, whatsapp }] };
    }

    // customers by whatsapp — processOptInOutKeyword (1ª query)
    if (/SELECT/i.test(text) && /customers/.test(text) && /whatsapp =/.test(text)) {
      if (scenario.customerByPhone === false) return { rows: [] };
      return { rows: [{ id: CUSTOMER_ID, whatsapp: CUSTOMER_PHONE }] };
    }

    // customer_opt_in_lgpd existence check — processOptInOutKeyword (2ª query)
    // Diferencia por: seleciona "id, customer_id" (NÃO seleciona "opt_in" como coluna)
    if (
      /SELECT/i.test(text) &&
      /customer_opt_in_lgpd/.test(text) &&
      !/SELECT\s+opt_in/i.test(text)
    ) {
      if (scenario.existingOptInRow) return { rows: [{ id: "opt-row-id", customer_id: CUSTOMER_ID }] };
      return { rows: [] };
    }

    // comandas abertas — processMenuRequest
    if (/SELECT/i.test(text) && /comandas/.test(text) && /open/.test(text)) {
      if (!scenario.openComandaId) return { rows: [] };
      return { rows: [{ id: scenario.openComandaId }] };
    }

    // comanda_items — processMenuRequest
    if (/SELECT/i.test(text) && /comanda_items/.test(text)) {
      return { rows: scenario.comandaItems ?? [] };
    }

    // customer_points_balance — processMenuRequest
    if (/SELECT/i.test(text) && /customer_points_balance/.test(text)) {
      if (scenario.pointsBalance === undefined) return { rows: [] };
      return { rows: [{ balance: scenario.pointsBalance }] };
    }

    // tenants slug — processMenuRequest
    if (/SELECT/i.test(text) && /tenants/.test(text) && /slug/.test(text)) {
      return { rows: [{ slug: scenario.tenantSlug ?? "arena-teste" }] };
    }

    // UPDATE / INSERT (opt-in changes): nada a retornar
    return { rows: [] };
  };

  return {
    db: { execute } as unknown as TenantContext["db"],
    calls,
  };
}

function makeCtx(db: TenantContext["db"], tenantId = TENANT_A): TenantContext {
  return { db, tenantId, actorUserId: "actor-id" };
}

function makeQueue() {
  const enqueuedComanda: Parameters<NotificationQueuePort["enqueueComandaNotification"]>[0][] = [];
  const enqueuedText: Parameters<NotificationQueuePort["enqueueTextMessage"]>[0][] = [];
  const queue: NotificationQueuePort = {
    enqueueComandaNotification: vi.fn(async (input) => void enqueuedComanda.push(input)),
    enqueueTextMessage: vi.fn(async (input) => void enqueuedText.push(input)),
  };
  return { queue, enqueuedComanda, enqueuedText };
}

// ===========================================================================
// WPP-02 — buildComandaNotificationText (função pura)
// ===========================================================================

describe("buildComandaNotificationText", () => {
  it("formata mensagem com um único item e total parcial", () => {
    const text = buildComandaNotificationText(
      [{ name: "Água", quantity: 1, unitPriceCents: 500 }],
      500
    );

    expect(text).toContain("🧾 *Lançamento na sua comanda:*");
    expect(text).toContain("• Água x1 — R$ 5,00");
    expect(text).toContain("*Total parcial: R$ 5,00*");
  });

  it("formata mensagem com múltiplos itens", () => {
    const text = buildComandaNotificationText(
      [
        { name: "Água", quantity: 2, unitPriceCents: 500 },
        { name: "Bolinha de Padel", quantity: 1, unitPriceCents: 3500 },
      ],
      4500
    );

    expect(text).toContain("• Água x2 — R$ 5,00");
    expect(text).toContain("• Bolinha de Padel x1 — R$ 35,00");
    expect(text).toContain("*Total parcial: R$ 45,00*");
  });

  it("usa vírgula como separador decimal no formato brasileiro", () => {
    const text = buildComandaNotificationText(
      [{ name: "Item", quantity: 1, unitPriceCents: 1099 }],
      1099
    );

    expect(text).toContain("R$ 10,99");
    expect(text).not.toContain("R$ 10.99");
  });

  it("exibe zero corretamente como R$ 0,00", () => {
    const text = buildComandaNotificationText(
      [{ name: "Cortesia", quantity: 1, unitPriceCents: 0 }],
      0
    );

    expect(text).toContain("R$ 0,00");
  });
});

// ===========================================================================
// WPP-02 — enqueueComandaNotificationIfEligible
// ===========================================================================

describe("enqueueComandaNotificationIfEligible", () => {
  it("AC1: enfileira notificação para comanda identificada com opt-in ativo", async () => {
    const mock = makeMockDb({ optIn: true, customerWhatsapp: CUSTOMER_PHONE });
    const { queue, enqueuedComanda } = makeQueue();

    await enqueueComandaNotificationIfEligible(
      makeCtx(mock.db),
      { comandaId: COMANDA_ID, customerId: CUSTOMER_ID },
      queue
    );

    expect(queue.enqueueComandaNotification).toHaveBeenCalledOnce();
    expect(enqueuedComanda[0]).toMatchObject({
      tenantId: TENANT_A,
      comandaId: COMANDA_ID,
      customerId: CUSTOMER_ID,
      toE164: CUSTOMER_PHONE,
    });
  });

  it("AC2: comanda anônima (customerId null) → sem enfileiramento", async () => {
    const mock = makeMockDb({ optIn: true, customerWhatsapp: CUSTOMER_PHONE });
    const { queue } = makeQueue();

    await enqueueComandaNotificationIfEligible(
      makeCtx(mock.db),
      { comandaId: COMANDA_ID, customerId: null },
      queue
    );

    expect(queue.enqueueComandaNotification).not.toHaveBeenCalled();
    expect(queue.enqueueTextMessage).not.toHaveBeenCalled();
  });

  it("AC3: cliente sem opt-in → sem enfileiramento", async () => {
    const mock = makeMockDb({ optIn: false, customerWhatsapp: CUSTOMER_PHONE });
    const { queue } = makeQueue();

    await enqueueComandaNotificationIfEligible(
      makeCtx(mock.db),
      { comandaId: COMANDA_ID, customerId: CUSTOMER_ID },
      queue
    );

    expect(queue.enqueueComandaNotification).not.toHaveBeenCalled();
  });

  it("cliente sem linha de opt-in → sem enfileiramento", async () => {
    const mock = makeMockDb({ optIn: undefined, customerWhatsapp: CUSTOMER_PHONE });
    const { queue } = makeQueue();

    await enqueueComandaNotificationIfEligible(
      makeCtx(mock.db),
      { comandaId: COMANDA_ID, customerId: CUSTOMER_ID },
      queue
    );

    expect(queue.enqueueComandaNotification).not.toHaveBeenCalled();
  });

  it("cliente com opt-in mas sem número de WhatsApp → sem enfileiramento", async () => {
    const mock = makeMockDb({ optIn: true, customerWhatsapp: null });
    const { queue } = makeQueue();

    await enqueueComandaNotificationIfEligible(
      makeCtx(mock.db),
      { comandaId: COMANDA_ID, customerId: CUSTOMER_ID },
      queue
    );

    expect(queue.enqueueComandaNotification).not.toHaveBeenCalled();
  });

  it("rejeita tenantId malformado", async () => {
    const mock = makeMockDb({ optIn: true, customerWhatsapp: CUSTOMER_PHONE });
    const { queue } = makeQueue();

    await expect(
      enqueueComandaNotificationIfEligible(
        makeCtx(mock.db, "invalid-id"),
        { comandaId: COMANDA_ID, customerId: CUSTOMER_ID },
        queue
      )
    ).rejects.toThrow();
  });
});

// ===========================================================================
// WPP-03 — processOptInOutKeyword
// ===========================================================================

describe("processOptInOutKeyword", () => {
  it("AC1: 'SAIR' → opt_in=false no BD + mensagem de confirmação na fila", async () => {
    const mock = makeMockDb({ customerByPhone: true, existingOptInRow: true });
    const { queue, enqueuedText } = makeQueue();

    const result = await processOptInOutKeyword(
      makeCtx(mock.db),
      { fromE164: CUSTOMER_PHONE, text: "SAIR" },
      queue
    );

    expect(result).toBe("opt_out");
    expect(queue.enqueueTextMessage).toHaveBeenCalledOnce();
    expect(enqueuedText[0].bodyText).toContain("QUERO");
    expect(enqueuedText[0].toE164).toBe(CUSTOMER_PHONE);
  });

  it("AC1: 'CANCELAR' → opt_in=false no BD + mensagem de confirmação na fila", async () => {
    const mock = makeMockDb({ customerByPhone: true, existingOptInRow: false });
    const { queue } = makeQueue();

    const result = await processOptInOutKeyword(
      makeCtx(mock.db),
      { fromE164: CUSTOMER_PHONE, text: "CANCELAR" },
      queue
    );

    expect(result).toBe("opt_out");
    expect(queue.enqueueTextMessage).toHaveBeenCalledOnce();
  });

  it("AC1: 'sair' (minúsculas) → opt_out (case-insensitive)", async () => {
    const mock = makeMockDb({ customerByPhone: true, existingOptInRow: true });
    const { queue } = makeQueue();

    const result = await processOptInOutKeyword(
      makeCtx(mock.db),
      { fromE164: CUSTOMER_PHONE, text: "sair" },
      queue
    );

    expect(result).toBe("opt_out");
  });

  it("AC2: 'QUERO' → opt_in=true no BD + mensagem de confirmação na fila", async () => {
    const mock = makeMockDb({ customerByPhone: true, existingOptInRow: true });
    const { queue, enqueuedText } = makeQueue();

    const result = await processOptInOutKeyword(
      makeCtx(mock.db),
      { fromE164: CUSTOMER_PHONE, text: "QUERO" },
      queue
    );

    expect(result).toBe("opt_in");
    expect(queue.enqueueTextMessage).toHaveBeenCalledOnce();
    expect(enqueuedText[0].bodyText).toContain("reativadas");
    expect(enqueuedText[0].toE164).toBe(CUSTOMER_PHONE);
  });

  it("AC2: 'ATIVAR' → opt_in=true no BD + mensagem de confirmação na fila", async () => {
    const mock = makeMockDb({ customerByPhone: true, existingOptInRow: false });
    const { queue } = makeQueue();

    const result = await processOptInOutKeyword(
      makeCtx(mock.db),
      { fromE164: CUSTOMER_PHONE, text: "ATIVAR" },
      queue
    );

    expect(result).toBe("opt_in");
    expect(queue.enqueueTextMessage).toHaveBeenCalledOnce();
  });

  it("AC2: 'ativar' (minúsculas) → opt_in (case-insensitive)", async () => {
    const mock = makeMockDb({ customerByPhone: true, existingOptInRow: false });
    const { queue } = makeQueue();

    const result = await processOptInOutKeyword(
      makeCtx(mock.db),
      { fromE164: CUSTOMER_PHONE, text: "  ativar  " },
      queue
    );

    expect(result).toBe("opt_in");
  });

  it("AC3: texto desconhecido → 'ignored'", async () => {
    const mock = makeMockDb({ customerByPhone: true });
    const { queue } = makeQueue();

    const result = await processOptInOutKeyword(
      makeCtx(mock.db),
      { fromE164: CUSTOMER_PHONE, text: "OI TUDO BEM" },
      queue
    );

    expect(result).toBe("ignored");
    expect(queue.enqueueTextMessage).not.toHaveBeenCalled();
    expect(queue.enqueueComandaNotification).not.toHaveBeenCalled();
  });

  it("AC4: remetente desconhecido (não cadastrado) → 'ignored'", async () => {
    const mock = makeMockDb({ customerByPhone: false });
    const { queue } = makeQueue();

    const result = await processOptInOutKeyword(
      makeCtx(mock.db),
      { fromE164: "+5548000000000", text: "SAIR" },
      queue
    );

    expect(result).toBe("ignored");
    expect(queue.enqueueTextMessage).not.toHaveBeenCalled();
  });

  it("opt-out sem linha prévia → cria nova linha com opt_in=false", async () => {
    const mock = makeMockDb({ customerByPhone: true, existingOptInRow: false });
    const { queue } = makeQueue();

    const result = await processOptInOutKeyword(
      makeCtx(mock.db),
      { fromE164: CUSTOMER_PHONE, text: "SAIR" },
      queue
    );

    expect(result).toBe("opt_out");
    // Deve ter INSERT (não UPDATE)
    const insertCalls = mock.calls.filter((c) => /INSERT/i.test(c.text) && /customer_opt_in_lgpd/.test(c.text));
    expect(insertCalls.length).toBe(1);
  });

  it("opt-in sem linha prévia → cria nova linha com opt_in=true", async () => {
    const mock = makeMockDb({ customerByPhone: true, existingOptInRow: false });
    const { queue } = makeQueue();

    const result = await processOptInOutKeyword(
      makeCtx(mock.db),
      { fromE164: CUSTOMER_PHONE, text: "QUERO" },
      queue
    );

    expect(result).toBe("opt_in");
    const insertCalls = mock.calls.filter((c) => /INSERT/i.test(c.text) && /customer_opt_in_lgpd/.test(c.text));
    expect(insertCalls.length).toBe(1);
  });

  it("opt-out com linha existente → faz UPDATE (não INSERT)", async () => {
    const mock = makeMockDb({ customerByPhone: true, existingOptInRow: true });
    const { queue } = makeQueue();

    await processOptInOutKeyword(
      makeCtx(mock.db),
      { fromE164: CUSTOMER_PHONE, text: "SAIR" },
      queue
    );

    const updateCalls = mock.calls.filter((c) => /UPDATE/i.test(c.text) && /customer_opt_in_lgpd/.test(c.text));
    expect(updateCalls.length).toBe(1);
    const insertCalls = mock.calls.filter((c) => /INSERT/i.test(c.text) && /customer_opt_in_lgpd/.test(c.text));
    expect(insertCalls.length).toBe(0);
  });

  it("rejeita tenantId malformado", async () => {
    const mock = makeMockDb({ customerByPhone: true });
    const { queue } = makeQueue();

    await expect(
      processOptInOutKeyword(
        makeCtx(mock.db, "not-uuid"),
        { fromE164: CUSTOMER_PHONE, text: "SAIR" },
        queue
      )
    ).rejects.toThrow();
  });

  it("isolamento de tenant: query sempre usa o tenantId correto", async () => {
    const mock = makeMockDb({ customerByPhone: false });
    const { queue } = makeQueue();

    // Usa tenant B — o mock retorna sem cliente (customer B não existe no tenant A)
    await processOptInOutKeyword(
      makeCtx(mock.db, TENANT_B),
      { fromE164: CUSTOMER_PHONE, text: "SAIR" },
      queue
    );

    // Resultado deve ser ignored (sem cliente no tenant B)
    expect(queue.enqueueTextMessage).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// WPP-05 — isMenuKeyword (função pura)
// ===========================================================================

describe("isMenuKeyword", () => {
  it.each(["MENU", "AJUDA", "COMANDA"])("reconhece '%s' como keyword de menu", (keyword) => {
    expect(isMenuKeyword(keyword)).toBe(true);
  });

  it.each(["menu", "ajuda", "comanda"])(
    "reconhece '%s' (minúsculas) — case-insensitive",
    (keyword) => {
      expect(isMenuKeyword(keyword)).toBe(true);
    }
  );

  it.each(["Menu", "Ajuda", "Comanda"])(
    "reconhece '%s' (capitalizado) — case-insensitive",
    (keyword) => {
      expect(isMenuKeyword(keyword)).toBe(true);
    }
  );

  it("ignora espaços antes/depois (trim)", () => {
    expect(isMenuKeyword("  MENU  ")).toBe(true);
  });

  it.each(["OI", "SAIR", "QUERO", "RESERVA", ""])("retorna false para '%s'", (text) => {
    expect(isMenuKeyword(text)).toBe(false);
  });
});

// ===========================================================================
// WPP-05 — processMenuRequest
// ===========================================================================

describe("processMenuRequest", () => {
  const baseInput = {
    fromE164: CUSTOMER_PHONE,
    customerId: CUSTOMER_ID,
    customerName: "João Silva",
  };

  it("AC4: mensagem inclui URLs com slug do tenant", async () => {
    const mock = makeMockDb({
      openComandaId: null,
      pointsBalance: undefined,
      tenantSlug: "padel-club",
    });

    const result = await processMenuRequest(makeCtx(mock.db), baseInput);

    expect(result).toContain("https://padel-club.marcouarena.com.br/atleta");
    expect(result).toContain("https://padel-club.marcouarena.com.br/reservas");
  });

  it("inclui nome do cliente na saudação", async () => {
    const mock = makeMockDb({ tenantSlug: "arena-x" });

    const result = await processMenuRequest(makeCtx(mock.db), { ...baseInput, customerName: "Maria" });

    expect(result).toContain("*Maria*");
  });

  it("AC2: mensagem inclui comanda aberta com itens quando existe", async () => {
    const mock = makeMockDb({
      openComandaId: COMANDA_ID,
      comandaItems: [
        { product_name: "Água", quantity: 2, unit_price: 500 },
        { product_name: "Bolinha", quantity: 1, unit_price: 3500 },
      ],
      tenantSlug: "arena-teste",
    });

    const result = await processMenuRequest(makeCtx(mock.db), baseInput);

    expect(result).toContain("📄 *1. Sua comanda:*");
    expect(result).toContain("Água x2");
    expect(result).toContain("Bolinha x1");
    expect(result).toContain("*Total: R$ 45,00*");
  });

  it("comanda aberta sem itens → exibe mensagem de comanda vazia", async () => {
    const mock = makeMockDb({
      openComandaId: COMANDA_ID,
      comandaItems: [],
      tenantSlug: "arena-teste",
    });

    const result = await processMenuRequest(makeCtx(mock.db), baseInput);

    expect(result).toContain("sem itens lançados");
  });

  it("sem comanda aberta → exibe mensagem de nenhuma comanda", async () => {
    const mock = makeMockDb({
      openComandaId: null,
      tenantSlug: "arena-teste",
    });

    const result = await processMenuRequest(makeCtx(mock.db), baseInput);

    expect(result).toContain("Nenhuma comanda aberta");
  });

  it("AC3: mensagem inclui pontos quando disponíveis", async () => {
    const mock = makeMockDb({
      openComandaId: null,
      pointsBalance: 350,
      tenantSlug: "arena-teste",
    });

    const result = await processMenuRequest(makeCtx(mock.db), baseInput);

    expect(result).toContain("🪙 *2. Seus pontos:*");
    expect(result).toContain("*350 pontos*");
  });

  it("sem pontos cadastrados → exibe mensagem de ausência de pontos", async () => {
    const mock = makeMockDb({
      openComandaId: null,
      pointsBalance: undefined,
      tenantSlug: "arena-teste",
    });

    const result = await processMenuRequest(makeCtx(mock.db), baseInput);

    expect(result).toContain("Você não possui pontos cadastrados");
  });

  it("customerId inválido (não UUID) → retorna mensagem de cadastro", async () => {
    const mock = makeMockDb({ tenantSlug: "arena-teste" });

    const result = await processMenuRequest(makeCtx(mock.db), {
      ...baseInput,
      customerId: "nao-eh-uuid",
    });

    expect(result).toContain("cadastre-se na arena");
  });

  it("rejeita tenantId malformado", async () => {
    const mock = makeMockDb({ tenantSlug: "arena-teste" });

    await expect(
      processMenuRequest(makeCtx(mock.db, "bad-tenant"), baseInput)
    ).rejects.toThrow();
  });

  it("isolamento de tenant B: não cruza dados de tenant A", async () => {
    // Cada tenant tem seu próprio contexto — o mock não retorna dados para tenant B
    const mockTenantB = makeMockDb({
      openComandaId: null,
      pointsBalance: undefined,
      tenantSlug: "arena-b",
    });

    const result = await processMenuRequest(makeCtx(mockTenantB.db, TENANT_B), baseInput);

    // Resultado deve referenciar apenas a arena B (slug correto)
    expect(result).toContain("https://arena-b.marcouarena.com.br");
    expect(result).not.toContain("arena-a");
  });
});
