import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TenantContext } from "../db/tenant";

/**
 * PDV-02/PDV-03 — núcleo de comanda.
 *
 * `comanda.service.ts` chama duas funções de outros módulos (`getCustomerById`
 * e `getProductById`). Em vez de simular as linhas cruas que ESSAS funções
 * leriam do banco (o que exigiria modelar consultas de dois módulos dentro
 * deste arquivo), nós as isolamos com `vi.mock` — o mesmo padrão já usado em
 * `apps/web/src/lib/session.test.ts` para isolar `getArenaUser`. O `ctx.db`
 * continua sendo um mock cru (estilo `customer.service.test.ts`), só que em
 * FILA: cada chamada a `.execute()` consome a próxima resposta, na ordem em
 * que `addItemToComanda`/`linkCustomerToComanda` etc. realmente as fazem.
 */

const getCustomerByIdMock = vi.fn();
vi.mock("../customers/customer.service", () => ({
  getCustomerById: (...args: unknown[]) => getCustomerByIdMock(...args),
}));

const getProductByIdMock = vi.fn();
const debitStockMock = vi.fn();
vi.mock("../product/product.service", () => ({
  getProductById: (...args: unknown[]) => getProductByIdMock(...args),
  debitStock: (...args: unknown[]) => debitStockMock(...args),
}));

const getCustomerPointsSummaryMock = vi.fn();
const redeemPointsMock = vi.fn();
vi.mock("../points/points.service", () => ({
  getCustomerPointsSummary: (...args: unknown[]) => getCustomerPointsSummaryMock(...args),
  redeemPoints: (...args: unknown[]) => redeemPointsMock(...args),
}));

const { openComanda, addItemToComanda, getComandaWithItems, listOpenComandas, linkCustomerToComanda, closeComanda, cancelComandaItem } =
  await import("./comanda.service");

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "22222222-2222-4222-8222-222222222222";
const CUSTOMER_ID = "33333333-3333-4333-8333-333333333333";
const COMANDA_ID = "44444444-4444-4444-8444-444444444444";
const PRODUCT_ID = "55555555-5555-4555-8555-555555555555";

/** Assertion helper: estreita um `{success:true|false}` para o ramo `true`. */
function assertSuccess<T extends { success: boolean }>(
  result: T
): asserts result is Extract<T, { success: true }> {
  if (!result.success) {
    throw new Error(`Esperava success:true, recebi: ${JSON.stringify(result)}`);
  }
}

/** Assertion helper: estreita um `{success:true|false}` para o ramo `false`. */
function assertFailure<T extends { success: boolean }>(
  result: T
): asserts result is Extract<T, { success: false }> {
  if (result.success) {
    throw new Error(`Esperava success:false, recebi: ${JSON.stringify(result)}`);
  }
}

function makeComandaRow(
  overrides: Partial<{
    id: string;
    tenant_id: string;
    customer_id: string | null;
    status: string;
    opened_by_user_id: string;
    created_at: Date;
    updated_at: Date;
  }> = {}
) {
  return {
    id: COMANDA_ID,
    tenant_id: TENANT_ID,
    customer_id: null,
    status: "open",
    opened_by_user_id: ACTOR_ID,
    created_at: new Date("2026-07-22T12:00:00Z"),
    updated_at: new Date("2026-07-22T12:00:00Z"),
    ...overrides,
  };
}

function makeItemRow(
  overrides: Partial<{
    id: string;
    tenant_id: string;
    comanda_id: string;
    product_id: string;
    product_name_at_sale: string;
    quantity: number;
    unit_price_cents_at_sale: number;
    operator_user_id: string;
    created_at: Date;
  }> = {}
) {
  return {
    id: "item-1",
    tenant_id: TENANT_ID,
    comanda_id: COMANDA_ID,
    product_id: PRODUCT_ID,
    product_name_at_sale: "Água Mineral 500ml",
    quantity: 1,
    unit_price_cents_at_sale: 500,
    operator_user_id: ACTOR_ID,
    created_at: new Date("2026-07-22T12:05:00Z"),
    ...overrides,
  };
}

/**
 * Mock em FILA do handle Drizzle: cada chamada a `.execute()` devolve a
 * próxima resposta da fila, na ordem das chamadas feitas pela função sob
 * teste. Se a fila esgotar, lança um erro claro em vez de devolver `undefined`
 * — isso também serve para PROVAR que uma função não fez uma chamada extra
 * (ex.: nenhum SELECT de produto quando a comanda já não foi encontrada).
 */
function mkQueueCtx(responseQueue: unknown[][], overrides: Partial<TenantContext> = {}): TenantContext {
  const queue = [...responseQueue];
  let callCount = 0;
  const db = {
    execute: async () => {
      callCount += 1;
      if (queue.length === 0) {
        throw new Error(
          `mkQueueCtx: fila de respostas esgotada na chamada #${callCount} a .execute() — ` +
            "o teste não previu esta chamada (a função sob teste consultou o banco mais vezes do que o esperado)."
        );
      }
      return { rows: queue.shift() };
    },
  };
  return {
    db: db as unknown as TenantContext["db"],
    tenantId: TENANT_ID,
    actorUserId: ACTOR_ID,
    ...overrides,
  };
}

beforeEach(() => {
  getCustomerByIdMock.mockReset();
  getProductByIdMock.mockReset();
  debitStockMock.mockReset();
});

describe("openComanda", () => {
  it("abre comanda vinculada a um cliente existente do tenant (caminho de busca)", async () => {
    getCustomerByIdMock.mockResolvedValueOnce({ id: CUSTOMER_ID, tenantId: TENANT_ID });
    const ctx = mkQueueCtx([
      [], // SELECT comanda aberta existente (vazio)
      [makeComandaRow({ customer_id: CUSTOMER_ID })], // INSERT comandas RETURNING
      [{}], // audit log
    ]);

    const result = await openComanda(ctx, { customerId: CUSTOMER_ID });

    assertSuccess(result);
    expect(result.comanda.customerId).toBe(CUSTOMER_ID);
    expect(result.comanda.status).toBe("open");
    expect(getCustomerByIdMock).toHaveBeenCalledWith(ctx, CUSTOMER_ID);
  });

  it("falha com already_has_open_comanda se o cliente já tiver uma comanda aberta", async () => {
    getCustomerByIdMock.mockResolvedValueOnce({ id: CUSTOMER_ID, tenantId: TENANT_ID });
    const ctx = mkQueueCtx([
      [{ id: "comanda-existente-123" }], // SELECT id FROM comandas
    ]);

    const result = await openComanda(ctx, { customerId: CUSTOMER_ID });

    assertFailure(result);
    expect(result.reason).toBe("already_has_open_comanda");
    if (result.reason === "already_has_open_comanda") {
      expect(result.existingComandaId).toBe("comanda-existente-123");
    }
  });

  it("abre comanda balcão/anônima quando customerId é null (PDV-03)", async () => {
    const ctx = mkQueueCtx([[makeComandaRow({ customer_id: null })], [{}]]);

    const result = await openComanda(ctx, { customerId: null });

    assertSuccess(result);
    expect(result.comanda.customerId).toBeNull();
    expect(getCustomerByIdMock).not.toHaveBeenCalled();
  });

  it("abre comanda balcão quando customerId é omitido do input", async () => {
    const ctx = mkQueueCtx([[makeComandaRow({ customer_id: null })], [{}]]);

    const result = await openComanda(ctx, {});

    assertSuccess(result);
    expect(result.comanda.customerId).toBeNull();
    expect(getCustomerByIdMock).not.toHaveBeenCalled();
  });

  it("isolamento/IDOR: falha com customer_not_found quando o customerId não pertence ao tenant atual", async () => {
    // getCustomerById já filtra por tenant_id internamente (packages/core/src/customers/customer.service.ts);
    // um id de OUTRO tenant simplesmente não é encontrado — é assim que o
    // isolamento se manifesta na fronteira deste serviço.
    getCustomerByIdMock.mockResolvedValueOnce(null);
    const ctx = mkQueueCtx([]); // nenhuma chamada a .execute() deve acontecer

    const result = await openComanda(ctx, { customerId: CUSTOMER_ID });

    assertFailure(result);
    expect(result.reason).toBe("customer_not_found");
  });

  it("exige ctx.actorUserId (operador que abre a comanda)", async () => {
    const ctx = mkQueueCtx([], { actorUserId: undefined });

    await expect(openComanda(ctx, { customerId: null })).rejects.toThrow(/actorUserId/);
  });

  it("valida o formato do tenantId antes de tocar o banco", async () => {
    const ctx = mkQueueCtx([], { tenantId: "not-a-uuid" });

    await expect(openComanda(ctx, { customerId: null })).rejects.toThrow();
  });
});

describe("addItemToComanda", () => {
  it("lança item gravando snapshot do nome e preço vigente no momento do lançamento", async () => {
    getProductByIdMock.mockResolvedValueOnce({
      id: PRODUCT_ID,
      name: "Água Mineral 500ml",
      salePriceCents: 500,
    });
    const ctx = mkQueueCtx([
      [makeComandaRow({ status: "open" })], // SELECT comanda
      [makeItemRow({ quantity: 2, unit_price_cents_at_sale: 500 })], // INSERT item RETURNING
      [{ total: "1000" }], // SELECT SUM
    ]);

    const result = await addItemToComanda(ctx, { comandaId: COMANDA_ID, productId: PRODUCT_ID, quantity: 2 });

    assertSuccess(result);
    expect(result.item.productNameAtSale).toBe("Água Mineral 500ml");
    expect(result.item.unitPriceCentsAtSale).toBe(500);
    expect(result.item.quantity).toBe(2);
    expect(result.item.lineTotalCents).toBe(1000);
    expect(result.comandaTotalCents).toBe(1000);
    expect(getProductByIdMock).toHaveBeenCalledWith(PRODUCT_ID, ctx);
  });

  it("snapshot é imutável: um preço alterado no catálogo entre dois lançamentos não retroage sobre o item já gravado", async () => {
    // 1º lançamento — preço vigente na época: 500.
    getProductByIdMock.mockResolvedValueOnce({ id: PRODUCT_ID, name: "Suco", salePriceCents: 500 });
    const ctx1 = mkQueueCtx([
      [makeComandaRow({ status: "open" })],
      [makeItemRow({ id: "item-1", quantity: 1, unit_price_cents_at_sale: 500, product_name_at_sale: "Suco" })],
      [{ total: "500" }],
    ]);
    const first = await addItemToComanda(ctx1, { comandaId: COMANDA_ID, productId: PRODUCT_ID, quantity: 1 });
    assertSuccess(first);

    // Catálogo muda o preço para 700 DEPOIS do primeiro lançamento.
    getProductByIdMock.mockResolvedValueOnce({ id: PRODUCT_ID, name: "Suco", salePriceCents: 700 });
    const ctx2 = mkQueueCtx([
      [makeComandaRow({ status: "open" })],
      [makeItemRow({ id: "item-2", quantity: 1, unit_price_cents_at_sale: 700, product_name_at_sale: "Suco" })],
      [{ total: "1200" }],
    ]);
    const second = await addItemToComanda(ctx2, { comandaId: COMANDA_ID, productId: PRODUCT_ID, quantity: 1 });
    assertSuccess(second);

    // O item já gravado preserva o preço da ÉPOCA — nunca é recalculado a partir do catálogo atual.
    expect(first.item.unitPriceCentsAtSale).toBe(500);
    expect(second.item.unitPriceCentsAtSale).toBe(700);
  });

  it("soma comandaTotalCents considerando os itens já existentes na comanda, não só o novo item", async () => {
    getProductByIdMock.mockResolvedValueOnce({ id: PRODUCT_ID, name: "Cerveja", salePriceCents: 800 });
    const ctx = mkQueueCtx([
      [makeComandaRow({ status: "open" })],
      [makeItemRow({ quantity: 3, unit_price_cents_at_sale: 800 })],
      [{ total: "4200" }], // 2 itens prévios (R$18,00) + 3x R$8,00 deste lançamento = R$42,00
    ]);

    const result = await addItemToComanda(ctx, { comandaId: COMANDA_ID, productId: PRODUCT_ID, quantity: 3 });

    assertSuccess(result);
    expect(result.comandaTotalCents).toBe(4200);
  });

  it("isolamento: retorna comanda_not_found quando a comanda não existe ou pertence a outro tenant", async () => {
    const ctx = mkQueueCtx([[]]); // SELECT comanda (filtrado por tenant_id) não encontra nada

    const result = await addItemToComanda(ctx, { comandaId: COMANDA_ID, productId: PRODUCT_ID, quantity: 1 });

    assertFailure(result);
    expect(result.reason).toBe("comanda_not_found");
    expect(getProductByIdMock).not.toHaveBeenCalled();
  });

  it("retorna comanda_closed quando a comanda já foi encerrada", async () => {
    const ctx = mkQueueCtx([[makeComandaRow({ status: "closed" })]]);

    const result = await addItemToComanda(ctx, { comandaId: COMANDA_ID, productId: PRODUCT_ID, quantity: 1 });

    assertFailure(result);
    expect(result.reason).toBe("comanda_closed");
    expect(getProductByIdMock).not.toHaveBeenCalled();
  });

  it("retorna product_not_found quando o produto não existe ou pertence a outro tenant", async () => {
    getProductByIdMock.mockResolvedValueOnce(null);
    const ctx = mkQueueCtx([[makeComandaRow({ status: "open" })]]);

    const result = await addItemToComanda(ctx, { comandaId: COMANDA_ID, productId: PRODUCT_ID, quantity: 1 });

    assertFailure(result);
    expect(result.reason).toBe("product_not_found");
  });

  it("REGRESSÃO: não debita estoque ao lançar item (débito fica para o fechamento da comanda — PDV-07)", async () => {
    getProductByIdMock.mockResolvedValueOnce({ id: PRODUCT_ID, name: "Água", salePriceCents: 300 });
    const ctx = mkQueueCtx([[makeComandaRow({ status: "open" })], [makeItemRow()], [{ total: "300" }]]);

    const result = await addItemToComanda(ctx, { comandaId: COMANDA_ID, productId: PRODUCT_ID, quantity: 1 });

    assertSuccess(result);
    expect(debitStockMock).not.toHaveBeenCalled();
  });

  it("rejeita quantidade zero ou negativa (limite do schema)", async () => {
    const ctx = mkQueueCtx([]);

    await expect(
      addItemToComanda(ctx, { comandaId: COMANDA_ID, productId: PRODUCT_ID, quantity: 0 })
    ).rejects.toThrow();
  });

  it("exige ctx.actorUserId (operador do lançamento)", async () => {
    const ctx = mkQueueCtx([], { actorUserId: undefined });

    await expect(
      addItemToComanda(ctx, { comandaId: COMANDA_ID, productId: PRODUCT_ID, quantity: 1 })
    ).rejects.toThrow(/actorUserId/);
  });
});

describe("getComandaWithItems", () => {
  it("retorna a comanda identificada com itens e total corretos", async () => {
    const ctx = mkQueueCtx([
      [
        {
          ...makeComandaRow({ customer_id: CUSTOMER_ID }),
          customer_name: "Maria Silva",
          customer_whatsapp: "+5511999999999",
        },
      ],
      [
        makeItemRow({ id: "item-1", quantity: 1, unit_price_cents_at_sale: 500 }),
        makeItemRow({ id: "item-2", quantity: 2, unit_price_cents_at_sale: 300 }),
      ],
      [], // SELECT payments
    ]);

    const result = await getComandaWithItems(ctx, COMANDA_ID);

    expect(result).not.toBeNull();
    if (!result) throw new Error("esperava encontrar a comanda");
    // A ordenação real (ORDER BY created_at ASC) acontece no SQL — conferida por
    // leitura do código; aqui garantimos que o serviço preserva fielmente a
    // ordem devolvida pelo banco (não reordena/inverte por conta própria).
    expect(result.items.map((i) => i.id)).toEqual(["item-1", "item-2"]);
    expect(result.totalCents).toBe(500 + 2 * 300);
    expect(result.customerName).toBe("Maria Silva");
    expect(result.customerWhatsapp).toBe("+5511999999999");
  });

  it("retorna customerName/customerWhatsapp null em venda balcão (sem cliente vinculado)", async () => {
    const ctx = mkQueueCtx([
      [{ ...makeComandaRow({ customer_id: null }), customer_name: null, customer_whatsapp: null }],
      [], // SELECT items
      [], // SELECT payments
    ]);

    const result = await getComandaWithItems(ctx, COMANDA_ID);

    expect(result).not.toBeNull();
    if (!result) throw new Error("esperava encontrar a comanda");
    expect(result.customerName).toBeNull();
    expect(result.customerWhatsapp).toBeNull();
    expect(result.items).toEqual([]);
    expect(result.totalCents).toBe(0);
  });

  it("isolamento: retorna null quando a comanda pertence a outro tenant", async () => {
    const ctx = mkQueueCtx([[]]); // JOIN com WHERE tenant_id = ctx.tenantId não encontra nada

    const result = await getComandaWithItems(ctx, COMANDA_ID);

    expect(result).toBeNull();
    // A fila só tem 1 resposta: se a função buscasse itens mesmo sem achar a
    // comanda, o mock lançaria "fila esgotada" e este teste falharia.
  });
});

describe("listOpenComandas (PDV-04)", () => {
  it("mapeia nome/whatsapp, total e contagem de itens das comandas abertas", async () => {
    const ctx = mkQueueCtx([
      [
        {
          id: COMANDA_ID,
          customer_id: CUSTOMER_ID,
          customer_name: "Maria Silva",
          customer_whatsapp: "+5511999999999",
          created_at: new Date("2026-07-22T10:00:00Z"),
          total_cents: "1500", // Postgres devolve SUM como string
          item_count: "3",
        },
      ],
    ]);

    const result = await listOpenComandas(ctx);

    expect(result).toHaveLength(1);
    expect(result[0].customerName).toBe("Maria Silva");
    expect(result[0].customerWhatsapp).toBe("+5511999999999");
    expect(result[0].totalCents).toBe(1500); // convertido para número
    expect(result[0].itemCount).toBe(3);
    expect(result[0].openedAt).toEqual(new Date("2026-07-22T10:00:00Z"));
  });

  it("customerName null vira 'Venda Balcão' na camada de UI — o serviço só devolve null", async () => {
    const ctx = mkQueueCtx([
      [
        {
          id: COMANDA_ID,
          customer_id: null,
          customer_name: null,
          customer_whatsapp: null,
          created_at: new Date(),
          total_cents: 0,
          item_count: 0,
        },
      ],
    ]);

    const result = await listOpenComandas(ctx);

    expect(result[0].customerName).toBeNull();
    expect(result[0].totalCents).toBe(0);
    expect(result[0].itemCount).toBe(0);
  });

  it("retorna lista vazia quando não há comandas abertas", async () => {
    const ctx = mkQueueCtx([[]]);

    const result = await listOpenComandas(ctx);

    expect(result).toEqual([]);
  });

  it("rejeita tenantId inválido antes de consultar o banco", async () => {
    const ctx = mkQueueCtx([], { tenantId: "not-a-uuid" });

    await expect(listOpenComandas(ctx)).rejects.toThrow();
  });
});

describe("linkCustomerToComanda", () => {
  it("vincula um cliente a uma comanda balcão, tornando-a identificada (PDV-03 AC3)", async () => {
    getCustomerByIdMock.mockResolvedValueOnce({ id: CUSTOMER_ID, tenantId: TENANT_ID });
    const ctx = mkQueueCtx([
      [makeComandaRow({ customer_id: null, status: "open" })], // SELECT comanda
      [], // SELECT comanda aberta existente (vazio)
      [makeComandaRow({ customer_id: CUSTOMER_ID, status: "open" })], // UPDATE ... RETURNING
      [{}], // audit log
    ]);

    const result = await linkCustomerToComanda(ctx, { comandaId: COMANDA_ID, customerId: CUSTOMER_ID });

    assertSuccess(result);
    expect(result.comanda.customerId).toBe(CUSTOMER_ID);
  });

  it("falha customer_already_has_open_comanda se o cliente já tiver outra comanda aberta", async () => {
    getCustomerByIdMock.mockResolvedValueOnce({ id: CUSTOMER_ID, tenantId: TENANT_ID });
    const ctx = mkQueueCtx([
      [makeComandaRow({ customer_id: null, status: "open" })], // SELECT comanda
      [{ id: "outra-comanda-aberta-999" }], // SELECT id FROM comandas
    ]);

    const result = await linkCustomerToComanda(ctx, { comandaId: COMANDA_ID, customerId: CUSTOMER_ID });

    assertFailure(result);
    expect(result.reason).toBe("customer_already_has_open_comanda");
    if (result.reason === "customer_already_has_open_comanda") {
      expect(result.existingComandaId).toBe("outra-comanda-aberta-999");
    }
  });

  it("falha already_identified quando a comanda já tem cliente vinculado (guarda antecipada)", async () => {
    const ctx = mkQueueCtx([[makeComandaRow({ customer_id: "outro-cliente-ja-vinculado", status: "open" })]]);

    const result = await linkCustomerToComanda(ctx, { comandaId: COMANDA_ID, customerId: CUSTOMER_ID });

    assertFailure(result);
    expect(result.reason).toBe("already_identified");
    // guarda antecipada: nem chega a validar o novo cliente candidato
    expect(getCustomerByIdMock).not.toHaveBeenCalled();
  });

  it("falha already_identified quando duas vinculações concorrem pela mesma comanda (guarda condicional atômica perde a corrida)", async () => {
    getCustomerByIdMock.mockResolvedValueOnce({ id: CUSTOMER_ID, tenantId: TENANT_ID });
    const ctx = mkQueueCtx([
      [makeComandaRow({ customer_id: null, status: "open" })], // SELECT: parecia livre neste instante
      [], // SELECT comanda aberta existente (vazio)
      [], // UPDATE ... WHERE customer_id IS NULL não afeta nenhuma linha: outro operador venceu a corrida
    ]);

    const result = await linkCustomerToComanda(ctx, { comandaId: COMANDA_ID, customerId: CUSTOMER_ID });

    assertFailure(result);
    expect(result.reason).toBe("already_identified");
  });

  it("isolamento: falha comanda_not_found quando a comanda não existe ou pertence a outro tenant", async () => {
    const ctx = mkQueueCtx([[]]);

    const result = await linkCustomerToComanda(ctx, { comandaId: COMANDA_ID, customerId: CUSTOMER_ID });

    assertFailure(result);
    expect(result.reason).toBe("comanda_not_found");
    expect(getCustomerByIdMock).not.toHaveBeenCalled();
  });

  it("falha comanda_closed quando a comanda já foi encerrada", async () => {
    const ctx = mkQueueCtx([[makeComandaRow({ customer_id: null, status: "closed" })]]);

    const result = await linkCustomerToComanda(ctx, { comandaId: COMANDA_ID, customerId: CUSTOMER_ID });

    assertFailure(result);
    expect(result.reason).toBe("comanda_closed");
  });

  it("isolamento/IDOR: falha customer_not_found quando o customerId pertence a outro tenant", async () => {
    getCustomerByIdMock.mockResolvedValueOnce(null);
    const ctx = mkQueueCtx([[makeComandaRow({ customer_id: null, status: "open" })]]);

    const result = await linkCustomerToComanda(ctx, { comandaId: COMANDA_ID, customerId: CUSTOMER_ID });

    assertFailure(result);
    expect(result.reason).toBe("customer_not_found");
  });

  it("exige ctx.actorUserId (operador que vincula o cliente)", async () => {
    const ctx = mkQueueCtx([], { actorUserId: undefined });

    await expect(
      linkCustomerToComanda(ctx, { comandaId: COMANDA_ID, customerId: CUSTOMER_ID })
    ).rejects.toThrow(/actorUserId/);
  });
});

describe("closeComanda (PDV-07)", () => {
  function makePaymentRow(overrides: Partial<{ id: string; amount_cents: number; change_cents: number }> = {}) {
    return {
      id: "pay-1",
      tenant_id: TENANT_ID,
      comanda_id: COMANDA_ID,
      payment_method: "pix",
      amount_cents: 5000,
      received_cents: null,
      change_cents: 0,
      operator_user_id: ACTOR_ID,
      created_at: new Date("2026-07-22T14:00:00Z"),
      ...overrides,
    };
  }

  it("fecha comanda aberta com múltiplos meios de pagamento com sucesso", async () => {
    const ctx = mkQueueCtx([
      [makeComandaRow({ status: "open" })], // SELECT comanda
      [{ total: "5000" }], // SELECT SUM
      [makeComandaRow({ status: "closed" })], // UPDATE comanda status = 'closed'
      [], // SELECT current open cash session -> null
      [makePaymentRow({ payment_method: "pix", amount_cents: 3000 })], // INSERT payment 1
      [makePaymentRow({ id: "pay-2", payment_method: "cartao_credito", amount_cents: 2000 })], // INSERT payment 2
      [{}], // audit log
    ]);

    const result = await closeComanda(ctx, {
      comandaId: COMANDA_ID,
      payments: [
        { paymentMethod: "pix", amountCents: 3000 },
        { paymentMethod: "cartao_credito", amountCents: 2000 },
      ],
    });

    assertSuccess(result);
    expect(result.comanda.status).toBe("closed");
    expect(result.payments).toHaveLength(2);
    expect(result.totalChangeCents).toBe(0);
  });

  it("calcula troco corretamente para pagamento em dinheiro", async () => {
    const ctx = mkQueueCtx([
      [makeComandaRow({ status: "open" })],
      [{ total: "4000" }],
      [makeComandaRow({ status: "closed" })],
      [], // SELECT current open cash session -> null
      [makePaymentRow({ payment_method: "dinheiro", amount_cents: 4000, received_cents: 5000, change_cents: 1000 })],
      [{}],
    ]);

    const result = await closeComanda(ctx, {
      comandaId: COMANDA_ID,
      payments: [{ paymentMethod: "dinheiro", amountCents: 4000, receivedCents: 5000 }],
    });

    assertSuccess(result);
    expect(result.totalChangeCents).toBe(1000);
    expect(result.payments[0].changeCents).toBe(1000);
  });

  it("falha com comanda_empty se a comanda não possui itens lançados", async () => {
    const ctx = mkQueueCtx([
      [makeComandaRow({ status: "open" })],
      [{ total: "0" }],
    ]);

    const result = await closeComanda(ctx, {
      comandaId: COMANDA_ID,
      payments: [{ paymentMethod: "pix", amountCents: 500 }],
    });

    assertFailure(result);
    expect(result.reason).toBe("comanda_empty");
  });

  it("falha com insufficient_payment se o total pago for menor que o valor da comanda", async () => {
    const ctx = mkQueueCtx([
      [makeComandaRow({ status: "open" })],
      [{ total: "5000" }],
    ]);

    const result = await closeComanda(ctx, {
      comandaId: COMANDA_ID,
      payments: [{ paymentMethod: "pix", amountCents: 3000 }],
    });

    assertFailure(result);
    expect(result.reason).toBe("insufficient_payment");
  });

  it("falha com invalid_cash_received se o valor recebido em dinheiro for menor que o valor cobrado", async () => {
    const ctx = mkQueueCtx([
      [makeComandaRow({ status: "open" })],
      [{ total: "5000" }],
    ]);

    const result = await closeComanda(ctx, {
      comandaId: COMANDA_ID,
      payments: [{ paymentMethod: "dinheiro", amountCents: 5000, receivedCents: 4000 }],
    });

    assertFailure(result);
    expect(result.reason).toBe("invalid_cash_received");
  });

  describe("PDV-08 — Resgate de pontos no fechamento", () => {
    it("falha com points_anonymous_comanda ao tentar pagar com pontos em comanda sem cliente", async () => {
      const ctx = mkQueueCtx([
        [makeComandaRow({ customer_id: null, status: "open" })],
        [{ total: "5000" }],
      ]);

      const result = await closeComanda(ctx, {
        comandaId: COMANDA_ID,
        payments: [{ paymentMethod: "pontos", amountCents: 1000 }, { paymentMethod: "pix", amountCents: 4000 }],
      });

      assertFailure(result);
      expect(result.reason).toBe("points_anonymous_comanda");
    });

    it("falha com points_disabled se o programa de pontos estiver desativado na arena", async () => {
      getCustomerPointsSummaryMock.mockResolvedValueOnce({
        enabled: false,
        customerId: CUSTOMER_ID,
        balancePoints: 0,
        balanceValueCents: 0,
        maxAllowedRedemptionCents: 0,
      });

      const ctx = mkQueueCtx([
        [makeComandaRow({ customer_id: CUSTOMER_ID, status: "open" })],
        [{ total: "5000" }],
      ]);

      const result = await closeComanda(ctx, {
        comandaId: COMANDA_ID,
        payments: [{ paymentMethod: "pontos", amountCents: 1000 }, { paymentMethod: "pix", amountCents: 4000 }],
      });

      assertFailure(result);
      expect(result.reason).toBe("points_disabled");
    });

    it("falha com points_exceed_max_redemption se o valor em pontos exceder o limite da comanda", async () => {
      getCustomerPointsSummaryMock.mockResolvedValueOnce({
        enabled: true,
        customerId: CUSTOMER_ID,
        balancePoints: 5000,
        balanceValueCents: 5000,
        redemptionPointsPerReal: 100,
        maxAllowedRedemptionCents: 2500, // limite de 50% de 5000 = 2500 centavos
      });

      const ctx = mkQueueCtx([
        [makeComandaRow({ customer_id: CUSTOMER_ID, status: "open" })],
        [{ total: "5000" }],
      ]);

      const result = await closeComanda(ctx, {
        comandaId: COMANDA_ID,
        payments: [{ paymentMethod: "pontos", amountCents: 3000 }, { paymentMethod: "pix", amountCents: 2000 }],
      });

      assertFailure(result);
      expect(result.reason).toBe("points_exceed_max_redemption");
    });

    it("fecha a comanda com sucesso debitando os pontos do cliente quando elegível", async () => {
      getCustomerPointsSummaryMock.mockResolvedValueOnce({
        enabled: true,
        customerId: CUSTOMER_ID,
        balancePoints: 2000,
        balanceValueCents: 2000,
        redemptionPointsPerReal: 100,
        maxAllowedRedemptionCents: 2500,
      });
      redeemPointsMock.mockResolvedValueOnce({
        success: true,
        pointsRedeemed: 2000,
        remainingBalance: 0,
      });

      const ctx = mkQueueCtx([
        [makeComandaRow({ customer_id: CUSTOMER_ID, status: "open" })], // 1. SELECT comanda
        [{ total: "5000" }], // 2. SELECT comanda_items
        [makeComandaRow({ customer_id: CUSTOMER_ID, status: "closed" })], // 3. UPDATE comanda
        [], // 4. SELECT cash_session
        [makePaymentRow({ payment_method: "pontos", amount_cents: 2000 })], // 5. INSERT payment 1
        [makePaymentRow({ payment_method: "pix", amount_cents: 3000 })], // 6. INSERT payment 2
        [{}], // 7. INSERT audit_log
      ]);

      const result = await closeComanda(ctx, {
        comandaId: COMANDA_ID,
        payments: [{ paymentMethod: "pontos", amountCents: 2000 }, { paymentMethod: "pix", amountCents: 3000 }],
      });

      assertSuccess(result);
      expect(redeemPointsMock).toHaveBeenCalledWith(ctx, CUSTOMER_ID, 2000, COMANDA_ID);
      expect(result.comanda.status).toBe("closed");
    });
  });

  describe("cancelComandaItem (PDV-09)", () => {
    const ITEM_ID = "66666666-6666-4666-8666-666666666666";

    it("cancela o item com sucesso quando o operador é admin/gerente", async () => {
      const ctx = mkQueueCtx([
        [makeComandaRow({ status: "open" })], // 1. SELECT comanda
        [{ id: ITEM_ID, comanda_id: COMANDA_ID, product_id: PRODUCT_ID, quantity: 1, unit_price_cents_at_sale: 1000 }], // 2. SELECT comanda_items
        [{ role: "admin" }], // 3. SELECT user role
        [], // 4. DELETE comanda_items
        [{}], // 5. INSERT audit_log
      ]);

      const result = await cancelComandaItem(ctx, {
        comandaId: COMANDA_ID,
        comandaItemId: ITEM_ID,
        reason: "Cliente desistiu da bebida antes de abrir",
      });

      assertSuccess(result);
      expect(result.comandaItemId).toBe(ITEM_ID);
    });

    it("falha com comanda_closed se a comanda já estiver fechada", async () => {
      const ctx = mkQueueCtx([
        [makeComandaRow({ status: "closed" })],
      ]);

      const result = await cancelComandaItem(ctx, {
        comandaId: COMANDA_ID,
        comandaItemId: ITEM_ID,
        reason: "Item lançado por engano na comanda",
      });

      assertFailure(result);
      expect(result.reason).toBe("comanda_closed");
    });

    it("falha com item_not_found se o item não existir na comanda", async () => {
      const ctx = mkQueueCtx([
        [makeComandaRow({ status: "open" })],
        [], // SELECT comanda_items -> vazio
      ]);

      const result = await cancelComandaItem(ctx, {
        comandaId: COMANDA_ID,
        comandaItemId: ITEM_ID,
        reason: "Item lançado por engano",
      });

      assertFailure(result);
      expect(result.reason).toBe("item_not_found");
    });

    it("falha com unauthorized se o operador atendente não fornecer a senha do supervisor", async () => {
      const ctx = mkQueueCtx([
        [makeComandaRow({ status: "open" })],
        [{ id: ITEM_ID, comanda_id: COMANDA_ID, product_id: PRODUCT_ID, quantity: 1, unit_price_cents_at_sale: 1000 }],
        [{ role: "atendente" }],
      ]);

      const result = await cancelComandaItem(ctx, {
        comandaId: COMANDA_ID,
        comandaItemId: ITEM_ID,
        reason: "Cancelamento solicitado pelo cliente",
      });

      assertFailure(result);
      expect(result.reason).toBe("unauthorized");
    });
  });
});
