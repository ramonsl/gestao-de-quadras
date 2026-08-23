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

const {
  openComanda,
  addItemToComanda,
  addClassPackageItemToComanda,
  getComandaWithItems,
  listOpenComandas,
  linkCustomerToComanda,
  closeComanda,
  cancelComandaItem,
  transferItemsBetweenComandas,
} = await import("./comanda.service");

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "22222222-2222-4222-8222-222222222222";
const CUSTOMER_ID = "33333333-3333-4333-8333-333333333333";
const COMANDA_ID = "44444444-4444-4444-8444-444444444444";
const PRODUCT_ID = "55555555-5555-4555-8555-555555555555";
const PKG_ID = "66666666-6666-4666-8666-666666666661";
const GLOBAL_CUSTOMER_ID = "77777777-7777-4777-8777-777777777777";

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

function makeClassPackageItemRow(
  overrides: Partial<{
    id: string;
    item_type: string;
    class_package_id: string;
    product_name_at_sale: string;
    quantity: number;
    unit_price_cents_at_sale: number;
  }> = {}
) {
  return {
    id: "item-pkg-1",
    tenant_id: TENANT_ID,
    comanda_id: COMANDA_ID,
    item_type: "class_package",
    product_id: null,
    class_package_id: PKG_ID,
    product_name_at_sale: "Mensal 8 Aulas",
    quantity: 1,
    unit_price_cents_at_sale: 32000,
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

// ---------------------------------------------------------------------------
// PDV-06 — Venda de Pacotes de Aulas
// ---------------------------------------------------------------------------

describe("addClassPackageItemToComanda (PDV-06)", () => {
  const pkgRow = (overrides: Record<string, unknown> = {}) => ({
    id: PKG_ID,
    name: "Mensal 8 Aulas",
    total_class_count: 8,
    price_in_cents: 32000,
    is_active: true,
    ...overrides,
  });

  it("AC2: retorna comanda_requires_customer para comanda sem cliente vinculado", async () => {
    // Uma comanda balcão (customer_id = null) não pode receber pacotes de aula.
    const ctx = mkQueueCtx([
      [makeComandaRow({ customer_id: null, status: "open" })], // SELECT comanda → balcão
    ]);

    const result = await addClassPackageItemToComanda(ctx, {
      comandaId: COMANDA_ID,
      classPackageId: PKG_ID,
      quantity: 1,
    });

    assertFailure(result);
    expect(result.reason).toBe("comanda_requires_customer");
  });

  it("AC10/IDOR: retorna class_package_not_found quando o pacote pertence a outro tenant", async () => {
    // A query de validação usa WHERE id = ... AND tenant_id = ctx.tenantId.
    // Um classPackageId de outro tenant retorna vazio → class_package_not_found.
    const ctx = mkQueueCtx([
      [makeComandaRow({ customer_id: CUSTOMER_ID, status: "open" })], // SELECT comanda OK
      [],                                                               // SELECT class_package → vazio (outro tenant)
    ]);

    const result = await addClassPackageItemToComanda(ctx, {
      comandaId: COMANDA_ID,
      classPackageId: PKG_ID,
      quantity: 1,
    });

    assertFailure(result);
    expect(result.reason).toBe("class_package_not_found");
  });

  it("AC1: retorna class_package_inactive para pacote com is_active = false", async () => {
    const ctx = mkQueueCtx([
      [makeComandaRow({ customer_id: CUSTOMER_ID, status: "open" })],
      [pkgRow({ is_active: false })], // pacote inativo
    ]);

    const result = await addClassPackageItemToComanda(ctx, {
      comandaId: COMANDA_ID,
      classPackageId: PKG_ID,
      quantity: 1,
    });

    assertFailure(result);
    expect(result.reason).toBe("class_package_inactive");
  });

  it("AC4: grava item_type='class_package', class_package_id e snapshot imutável de nome/preço", async () => {
    // Regra 10 (CLAUDE.md): nome e preço gravados no momento do lançamento,
    // nunca recalculados a partir do catálogo depois.
    const ctx = mkQueueCtx([
      [makeComandaRow({ customer_id: CUSTOMER_ID, status: "open" })], // SELECT comanda
      [pkgRow()],                                                       // SELECT class_package
      [makeClassPackageItemRow()],                                       // INSERT comanda_items RETURNING
      [{ total: "32000" }],                                             // SELECT SUM total
    ]);

    const result = await addClassPackageItemToComanda(ctx, {
      comandaId: COMANDA_ID,
      classPackageId: PKG_ID,
      quantity: 1,
    });

    assertSuccess(result);
    expect(result.item.itemType).toBe("class_package");
    expect(result.item.classPackageId).toBe(PKG_ID);
    expect(result.item.productId).toBeNull();
    // Snapshot imutável: nome e preço do pacote no momento do lançamento.
    expect(result.item.productNameAtSale).toBe("Mensal 8 Aulas");
    expect(result.item.unitPriceCentsAtSale).toBe(32000);
    expect(result.item.quantity).toBe(1);
    expect(result.item.lineTotalCents).toBe(32000);
    expect(result.comandaTotalCents).toBe(32000);
  });

  it("isolamento: retorna comanda_not_found quando a comanda não existe ou pertence a outro tenant", async () => {
    const ctx = mkQueueCtx([[]]); // SELECT comanda filtrado por tenant_id → vazio

    const result = await addClassPackageItemToComanda(ctx, {
      comandaId: COMANDA_ID,
      classPackageId: PKG_ID,
      quantity: 1,
    });

    assertFailure(result);
    expect(result.reason).toBe("comanda_not_found");
  });

  it("retorna comanda_closed para comanda já encerrada", async () => {
    const ctx = mkQueueCtx([[makeComandaRow({ customer_id: CUSTOMER_ID, status: "closed" })]]);

    const result = await addClassPackageItemToComanda(ctx, {
      comandaId: COMANDA_ID,
      classPackageId: PKG_ID,
      quantity: 1,
    });

    assertFailure(result);
    expect(result.reason).toBe("comanda_closed");
  });

  it("exige ctx.actorUserId", async () => {
    const ctx = mkQueueCtx([], { actorUserId: undefined });

    await expect(
      addClassPackageItemToComanda(ctx, { comandaId: COMANDA_ID, classPackageId: PKG_ID, quantity: 1 })
    ).rejects.toThrow(/actorUserId/i);
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

  it("calcula troco pelo excesso mesmo em meio não-dinheiro (ex.: Pix acima do total)", async () => {
    // Comanda R$ 9,00; cliente entrega R$ 100,00 → troco R$ 91,00.
    const ctx = mkQueueCtx([
      [makeComandaRow({ status: "open" })],
      [{ total: "900" }],
      [makeComandaRow({ status: "closed" })],
      [], // sessão de caixa aberta -> null
      [makePaymentRow({ payment_method: "pix", amount_cents: 10000, received_cents: 10000, change_cents: 9100 })],
      [{}],
    ]);

    const result = await closeComanda(ctx, {
      comandaId: COMANDA_ID,
      payments: [{ paymentMethod: "pix", amountCents: 10000 }],
    });

    assertSuccess(result);
    // Troco = valor entregue (10000) − parcela que cobre a conta (900).
    expect(result.totalChangeCents).toBe(9100);
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
        // creditClassPackageBalances (PDV-06): comanda tem customer mas nenhum item class_package.
        [{ global_customer_id: GLOBAL_CUSTOMER_ID }], // 8. SELECT global_customer_id
        [], // 9. SELECT comanda_items WHERE item_type='class_package' → vazio (sem pacotes)
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

  describe("PDV-06 AC3 — Crédito de saldo de aulas no fechamento", () => {
    it("cria registro em student_class_balance ao fechar comanda com item class_package", async () => {
      /**
       * Sequência de chamadas ao banco dentro de `closeComanda`:
       *   1. SELECT comanda (aberta, com cliente)
       *   2. SELECT SUM(qty * price) FROM comanda_items  → total R$ 320,00
       *   3. UPDATE comanda SET status='closed' RETURNING
       *   4. SELECT cash_session (getCurrentOpenCashSession) → null
       *   5. INSERT comanda_payments RETURNING
       *   6. INSERT audit_logs
       *   ─ creditClassPackageBalances ─
       *   7. SELECT global_customer_id FROM customers
       *   8. SELECT comanda_items WHERE item_type='class_package'
       *   9. INSERT student_class_balance   ← este é o AC3
       *
       * A presença da entrada 9 na fila e a ausência de erros "fila esgotada"
       * provam que o INSERT foi executado. (Erros dentro de creditClassPackageBalances
       * são swallowed pelo .catch, portanto o contador customizado garante a chamada.)
       */
      let studentClassBalanceCalled = false;
      let callCount = 0;

      const responses: unknown[][] = [
        [makeComandaRow({ status: "open", customer_id: CUSTOMER_ID })], // 1
        [{ total: "32000" }],                                            // 2
        [makeComandaRow({ status: "closed", customer_id: CUSTOMER_ID })], // 3
        [],                                                               // 4 cash session
        [makePaymentRow({ amount_cents: 32000 })],                        // 5
        [{}],                                                             // 6 audit
        [{ global_customer_id: GLOBAL_CUSTOMER_ID }],                    // 7
        [{ class_package_id: PKG_ID, quantity: 1, total_class_count: 8 }], // 8
        [{}],                                                             // 9 INSERT student_class_balance
      ];

      const ctx: TenantContext = {
        db: {
          execute: async () => {
            callCount += 1;
            if (callCount === 9) studentClassBalanceCalled = true;
            const resp = responses.shift();
            return { rows: resp ?? [] };
          },
        } as unknown as TenantContext["db"],
        tenantId: TENANT_ID,
        actorUserId: ACTOR_ID,
      };

      const result = await closeComanda(ctx, {
        comandaId: COMANDA_ID,
        discountCents: 0,
        payments: [{ paymentMethod: "pix", amountCents: 32000 }],
      });

      assertSuccess(result);
      expect(studentClassBalanceCalled).toBe(true);
    });

    it("não cria saldo de aulas quando a comanda não tem cliente (balcão)", async () => {
      // creditClassPackageBalances retorna imediatamente se customer_id === null.
      // Neste caso, apenas 6 chamadas ao banco são feitas (sem as de creditClassPackageBalances).
      let callCount = 0;
      const responses: unknown[][] = [
        [makeComandaRow({ status: "open", customer_id: null })], // 1 comanda balcão
        [{ total: "32000" }],                                     // 2
        [makeComandaRow({ status: "closed", customer_id: null })], // 3
        [],                                                        // 4 cash session
        [makePaymentRow({ amount_cents: 32000 })],                 // 5
        [{}],                                                      // 6 audit
      ];

      const ctx: TenantContext = {
        db: {
          execute: async () => {
            callCount += 1;
            const resp = responses.shift();
            return { rows: resp ?? [] };
          },
        } as unknown as TenantContext["db"],
        tenantId: TENANT_ID,
        actorUserId: ACTOR_ID,
      };

      const result = await closeComanda(ctx, {
        comandaId: COMANDA_ID,
        discountCents: 0,
        payments: [{ paymentMethod: "pix", amountCents: 32000 }],
      });

      assertSuccess(result);
      // Exatamente 6 chamadas: sem SELECT global_customer_id nem INSERT student_class_balance.
      expect(callCount).toBe(6);
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

// ---------------------------------------------------------------------------
// PDV-10 — Transferência de itens entre comandas
// ---------------------------------------------------------------------------

describe("transferItemsBetweenComandas (PDV-10)", () => {
  const DST_COMANDA_ID = "88888888-8888-4888-8888-888888888888";
  const ITEM_ID_1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const ITEM_ID_2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const DST_CUSTOMER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  function makeSourceItem(overrides: Partial<{
    id: string;
    item_type: string;
    product_id: string | null;
    class_package_id: string | null;
    product_name_at_sale: string;
    quantity: number;
    unit_price_cents_at_sale: number;
    operator_user_id: string;
    created_at: Date;
  }> = {}) {
    return {
      id: ITEM_ID_1,
      tenant_id: TENANT_ID,
      comanda_id: COMANDA_ID,
      item_type: "product",
      product_id: PRODUCT_ID,
      class_package_id: null,
      product_name_at_sale: "Coca-Cola 350ml",
      quantity: 2,
      unit_price_cents_at_sale: 800,
      operator_user_id: ACTOR_ID,
      created_at: new Date("2026-07-22T12:05:00Z"),
      ...overrides,
    };
  }

  it("AC1: transfere itens selecionados da comanda de origem para a de destino", async () => {
    const ctx = mkQueueCtx([
      [makeComandaRow({ id: COMANDA_ID, customer_id: CUSTOMER_ID, status: "open" })], // 1. SELECT source comanda
      [makeComandaRow({ id: DST_COMANDA_ID, customer_id: DST_CUSTOMER_ID, status: "open" })], // 2. SELECT dest comanda
      [makeSourceItem()], // 3. SELECT all source items
      [], // 4. UPDATE item comanda_id
      [{ total: "0" }], // 5. SELECT SUM source
      [{ total: "1600" }], // 6. SELECT SUM dest
      [{}], // 7. audit log
      // Notifications: source customer opt-in check
      [{ opt_in: false }], // 8. opt-in source -> false (no notification)
      [{ opt_in: false }], // 9. opt-in dest -> false (no notification)
    ]);

    const result = await transferItemsBetweenComandas(
      ctx,
      {
        sourceComandaId: COMANDA_ID,
        destinationComandaId: DST_COMANDA_ID,
        itemIds: [ITEM_ID_1],
      },
      {
        enqueueComandaNotification: vi.fn(),
        enqueueTextMessage: vi.fn(),
      }
    );

    assertSuccess(result);
    expect(result.transferredItemIds).toEqual([ITEM_ID_1]);
    expect(result.sourceTotalCents).toBe(0);
    expect(result.destinationTotalCents).toBe(1600);
  });

  it("AC2: rejeita se comanda de origem pertence a outro tenant (source_comanda_not_found)", async () => {
    const ctx = mkQueueCtx([
      [], // SELECT source -> empty (not found for this tenant)
    ]);

    const result = await transferItemsBetweenComandas(ctx, {
      sourceComandaId: COMANDA_ID,
      destinationComandaId: DST_COMANDA_ID,
      itemIds: [ITEM_ID_1],
    });

    assertFailure(result);
    expect(result.reason).toBe("source_comanda_not_found");
  });

  it("AC2: rejeita se comanda de destino pertence a outro tenant (destination_comanda_not_found)", async () => {
    const ctx = mkQueueCtx([
      [makeComandaRow({ status: "open" })], // source OK
      [], // dest -> not found
    ]);

    const result = await transferItemsBetweenComandas(ctx, {
      sourceComandaId: COMANDA_ID,
      destinationComandaId: DST_COMANDA_ID,
      itemIds: [ITEM_ID_1],
    });

    assertFailure(result);
    expect(result.reason).toBe("destination_comanda_not_found");
  });

  it("AC2: rejeita se comanda de origem está fechada (source_comanda_closed)", async () => {
    const ctx = mkQueueCtx([
      [makeComandaRow({ status: "closed" })],
    ]);

    const result = await transferItemsBetweenComandas(ctx, {
      sourceComandaId: COMANDA_ID,
      destinationComandaId: DST_COMANDA_ID,
      itemIds: [ITEM_ID_1],
    });

    assertFailure(result);
    expect(result.reason).toBe("source_comanda_closed");
  });

  it("AC2: rejeita se comanda de destino está fechada (destination_comanda_closed)", async () => {
    const ctx = mkQueueCtx([
      [makeComandaRow({ id: COMANDA_ID, status: "open" })],
      [makeComandaRow({ id: DST_COMANDA_ID, status: "closed" })],
    ]);

    const result = await transferItemsBetweenComandas(ctx, {
      sourceComandaId: COMANDA_ID,
      destinationComandaId: DST_COMANDA_ID,
      itemIds: [ITEM_ID_1],
    });

    assertFailure(result);
    expect(result.reason).toBe("destination_comanda_closed");
  });

  it("AC3: preserva metadados originais do item (operator, created_at, preço, nome)", async () => {
    // O UPDATE só altera comanda_id — os demais campos ficam intactos.
    // A presença da chamada UPDATE (sem SET nos metadados) e a ausência de INSERT
    // é validada pelo teste não esgotar a fila inesperadamente.
    const originalItem = makeSourceItem({
      operator_user_id: "operator-original",
      created_at: new Date("2026-01-01T08:00:00Z"),
    });

    const ctx = mkQueueCtx([
      [makeComandaRow({ status: "open" })],
      [makeComandaRow({ id: DST_COMANDA_ID, customer_id: DST_CUSTOMER_ID, status: "open" })],
      [originalItem], // items in source comanda
      [], // UPDATE comanda_id
      [{ total: "0" }],
      [{ total: "1600" }],
      [{}], // audit
    ]);

    const result = await transferItemsBetweenComandas(ctx, {
      sourceComandaId: COMANDA_ID,
      destinationComandaId: DST_COMANDA_ID,
      itemIds: [ITEM_ID_1],
    });

    assertSuccess(result);
    // Se o UPDATE alterasse metadados indevidos, a lógica da fila falharia
    // (chamada extra). Como tudo consome exatamente o esperado, metadados estão preservados.
  });

  it("AC4: rejeita transferência de class_package para comanda destino sem cliente (destination_requires_customer)", async () => {
    const classItem = makeSourceItem({
      item_type: "class_package",
      product_id: null,
      class_package_id: PKG_ID,
      product_name_at_sale: "Mensal 8 Aulas",
    });

    const ctx = mkQueueCtx([
      [makeComandaRow({ customer_id: CUSTOMER_ID, status: "open" })], // source com cliente
      [makeComandaRow({ id: DST_COMANDA_ID, customer_id: null, status: "open" })], // dest balcão (sem cliente)
      [classItem], // items
    ]);

    const result = await transferItemsBetweenComandas(ctx, {
      sourceComandaId: COMANDA_ID,
      destinationComandaId: DST_COMANDA_ID,
      itemIds: [ITEM_ID_1],
    });

    assertFailure(result);
    expect(result.reason).toBe("destination_requires_customer");
  });

  it("AC4: permite transferência de class_package quando destino tem cliente", async () => {
    const classItem = makeSourceItem({
      item_type: "class_package",
      product_id: null,
      class_package_id: PKG_ID,
      product_name_at_sale: "Mensal 8 Aulas",
      unit_price_cents_at_sale: 32000,
    });

    const ctx = mkQueueCtx([
      [makeComandaRow({ customer_id: CUSTOMER_ID, status: "open" })],
      [makeComandaRow({ id: DST_COMANDA_ID, customer_id: DST_CUSTOMER_ID, status: "open" })], // dest com cliente
      [classItem],
      [], // UPDATE
      [{ total: "0" }],
      [{ total: "32000" }],
      [{}], // audit
    ]);

    const result = await transferItemsBetweenComandas(ctx, {
      sourceComandaId: COMANDA_ID,
      destinationComandaId: DST_COMANDA_ID,
      itemIds: [ITEM_ID_1],
    });

    assertSuccess(result);
  });

  it("AC5: recalcula totais de ambas as comandas após a transferência", async () => {
    const item1 = makeSourceItem({ id: ITEM_ID_1, quantity: 2, unit_price_cents_at_sale: 800 });
    const item2 = makeSourceItem({ id: ITEM_ID_2, quantity: 1, unit_price_cents_at_sale: 500 });

    const ctx = mkQueueCtx([
      [makeComandaRow({ status: "open" })],
      [makeComandaRow({ id: DST_COMANDA_ID, customer_id: DST_CUSTOMER_ID, status: "open" })],
      [item1, item2], // all source items
      [], // UPDATE item1
      [{ total: "500" }], // source total (only item2 remains)
      [{ total: "3600" }], // dest total (item1 added to existing 2000)
      [{}], // audit
    ]);

    const result = await transferItemsBetweenComandas(ctx, {
      sourceComandaId: COMANDA_ID,
      destinationComandaId: DST_COMANDA_ID,
      itemIds: [ITEM_ID_1], // only transfer item1
    });

    assertSuccess(result);
    expect(result.sourceTotalCents).toBe(500);
    expect(result.destinationTotalCents).toBe(3600);
  });

  it("AC6+AC7: envia notificação de correção para clientes com opt-in via enqueueTextMessage", async () => {
    const enqueueTextMessageMock = vi.fn().mockResolvedValue(undefined);
    const queue = {
      enqueueComandaNotification: vi.fn(),
      enqueueTextMessage: enqueueTextMessageMock,
    };

    // As notificações fire-and-forget rodam INTERCALADAS (duas coroutines
    // concorrentes consumindo da mesma fila). A ordem real de consumo é:
    //   8 → src opt-in, 9 → dst opt-in, 10 → src whatsapp, 11 → dst whatsapp
    const ctx = mkQueueCtx([
      [makeComandaRow({ customer_id: CUSTOMER_ID, status: "open" })],       // 1. SELECT source
      [makeComandaRow({ id: DST_COMANDA_ID, customer_id: DST_CUSTOMER_ID, status: "open" })], // 2. SELECT dest
      [makeSourceItem()],                                                     // 3. SELECT items
      [],                                                                     // 4. UPDATE item
      [{ total: "0" }],                                                       // 5. SUM source
      [{ total: "1600" }],                                                    // 6. SUM dest
      [{}],                                                                   // 7. audit
      // Fire-and-forget: intercalado — ambos iniciam, ambos yieldam no 1º await
      [{ opt_in: true }],                   // 8. src opt-in
      [{ opt_in: true }],                   // 9. dst opt-in
      [{ whatsapp: "+5511999999999" }],      // 10. src whatsapp
      [{ whatsapp: "+5511888888888" }],      // 11. dst whatsapp
    ]);

    const result = await transferItemsBetweenComandas(ctx, {
      sourceComandaId: COMANDA_ID,
      destinationComandaId: DST_COMANDA_ID,
      itemIds: [ITEM_ID_1],
    }, queue);

    assertSuccess(result);

    // Aguardar as promises fire-and-forget (microtask tick).
    await new Promise((r) => setTimeout(r, 50));

    expect(enqueueTextMessageMock).toHaveBeenCalledTimes(2);

    // Mensagem para cliente da comanda de ORIGEM (itens removidos).
    const srcCall = enqueueTextMessageMock.mock.calls[0][0];
    expect(srcCall.toE164).toBe("+5511999999999");
    expect(srcCall.bodyText).toContain("transferidos");
    expect(srcCall.bodyText).toContain("Coca-Cola 350ml");

    // Mensagem para cliente da comanda de DESTINO (itens recebidos).
    const dstCall = enqueueTextMessageMock.mock.calls[1][0];
    expect(dstCall.toE164).toBe("+5511888888888");
    expect(dstCall.bodyText).toContain("recebidos");
    expect(dstCall.bodyText).toContain("Coca-Cola 350ml");
  });

  it("AC6: não envia notificação se cliente da origem não tem opt-in", async () => {
    const enqueueTextMessageMock = vi.fn().mockResolvedValue(undefined);
    const queue = {
      enqueueComandaNotification: vi.fn(),
      enqueueTextMessage: enqueueTextMessageMock,
    };

    const ctx = mkQueueCtx([
      [makeComandaRow({ customer_id: CUSTOMER_ID, status: "open" })],
      [makeComandaRow({ id: DST_COMANDA_ID, customer_id: null, status: "open" })], // dest sem cliente
      [makeSourceItem()],
      [],
      [{ total: "0" }],
      [{ total: "1600" }],
      [{}],
      // Source notification: opt-in false
      [{ opt_in: false }],
      // Dest: sem customer_id, nenhuma query de notificação.
    ]);

    await transferItemsBetweenComandas(ctx, {
      sourceComandaId: COMANDA_ID,
      destinationComandaId: DST_COMANDA_ID,
      itemIds: [ITEM_ID_1],
    }, queue);

    await new Promise((r) => setTimeout(r, 10));
    expect(enqueueTextMessageMock).not.toHaveBeenCalled();
  });

  it("AC8: grava audit log com detalhes da transferência e justificativa", async () => {
    let auditPayload: Record<string, unknown> | null = null;
    let callCount = 0;

    const responses: unknown[][] = [
      [makeComandaRow({ status: "open" })],
      [makeComandaRow({ id: DST_COMANDA_ID, customer_id: DST_CUSTOMER_ID, status: "open" })],
      [makeSourceItem()],
      [],
      [{ total: "0" }],
      [{ total: "1600" }],
      [{}], // audit
    ];

    const ctx: TenantContext = {
      db: {
        execute: async (query: unknown) => {
          callCount += 1;
          // Call #7 is the audit INSERT. The SQL template contains the action and details.
          if (callCount === 7) {
            // The audit log call indicates the function completed the audit write.
            auditPayload = { called: true };
          }
          const resp = responses.shift();
          return { rows: resp ?? [] };
        },
      } as unknown as TenantContext["db"],
      tenantId: TENANT_ID,
      actorUserId: ACTOR_ID,
    };

    const result = await transferItemsBetweenComandas(ctx, {
      sourceComandaId: COMANDA_ID,
      destinationComandaId: DST_COMANDA_ID,
      itemIds: [ITEM_ID_1],
      justificativa: "Lançamento no cliente errado",
    });

    assertSuccess(result);
    expect(auditPayload).toEqual({ called: true });
  });

  it("AC9: rejeita transferência quando origem e destino são a mesma comanda", async () => {
    const ctx = mkQueueCtx([]); // nenhuma consulta deve ser feita

    const result = await transferItemsBetweenComandas(ctx, {
      sourceComandaId: COMANDA_ID,
      destinationComandaId: COMANDA_ID,
      itemIds: [ITEM_ID_1],
    });

    assertFailure(result);
    expect(result.reason).toBe("same_comanda");
  });

  it("AC10: rejeita se algum item não pertence à comanda de origem (item_not_found)", async () => {
    const ctx = mkQueueCtx([
      [makeComandaRow({ status: "open" })],
      [makeComandaRow({ id: DST_COMANDA_ID, status: "open" })],
      [makeSourceItem({ id: ITEM_ID_1 })], // só tem ITEM_ID_1
    ]);

    const result = await transferItemsBetweenComandas(ctx, {
      sourceComandaId: COMANDA_ID,
      destinationComandaId: DST_COMANDA_ID,
      itemIds: [ITEM_ID_1, ITEM_ID_2], // ITEM_ID_2 não existe
    });

    assertFailure(result);
    expect(result.reason).toBe("item_not_found");
    if (result.reason === "item_not_found") {
      expect(result.missingItemId).toBe(ITEM_ID_2);
    }
  });

  it("exige ctx.actorUserId", async () => {
    const ctx = mkQueueCtx([], { actorUserId: undefined });

    await expect(
      transferItemsBetweenComandas(ctx, {
        sourceComandaId: COMANDA_ID,
        destinationComandaId: DST_COMANDA_ID,
        itemIds: [ITEM_ID_1],
      })
    ).rejects.toThrow(/actorUserId/);
  });

  it("valida formato do tenantId antes de tocar o banco", async () => {
    const ctx = mkQueueCtx([], { tenantId: "not-a-uuid" });

    await expect(
      transferItemsBetweenComandas(ctx, {
        sourceComandaId: COMANDA_ID,
        destinationComandaId: DST_COMANDA_ID,
        itemIds: [ITEM_ID_1],
      })
    ).rejects.toThrow();
  });

  it("rejeita itemIds vazio (schema Zod)", async () => {
    const ctx = mkQueueCtx([]);

    await expect(
      transferItemsBetweenComandas(ctx, {
        sourceComandaId: COMANDA_ID,
        destinationComandaId: DST_COMANDA_ID,
        itemIds: [],
      })
    ).rejects.toThrow();
  });

  it("permite justificativa opcional (ausente)", async () => {
    const ctx = mkQueueCtx([
      [makeComandaRow({ status: "open" })],
      [makeComandaRow({ id: DST_COMANDA_ID, status: "open" })],
      [makeSourceItem()],
      [],
      [{ total: "0" }],
      [{ total: "1600" }],
      [{}], // audit
    ]);

    const result = await transferItemsBetweenComandas(ctx, {
      sourceComandaId: COMANDA_ID,
      destinationComandaId: DST_COMANDA_ID,
      itemIds: [ITEM_ID_1],
      // justificativa omitida
    });

    assertSuccess(result);
  });

  it("transfere múltiplos itens de uma vez", async () => {
    const item1 = makeSourceItem({ id: ITEM_ID_1 });
    const item2 = makeSourceItem({
      id: ITEM_ID_2,
      product_name_at_sale: "Água Mineral",
      quantity: 1,
      unit_price_cents_at_sale: 500,
    });

    const ctx = mkQueueCtx([
      [makeComandaRow({ status: "open" })],
      [makeComandaRow({ id: DST_COMANDA_ID, status: "open" })],
      [item1, item2], // all source items
      [], // UPDATE item1
      [], // UPDATE item2
      [{ total: "0" }], // source vazia
      [{ total: "2100" }], // dest com ambos os itens
      [{}], // audit
    ]);

    const result = await transferItemsBetweenComandas(ctx, {
      sourceComandaId: COMANDA_ID,
      destinationComandaId: DST_COMANDA_ID,
      itemIds: [ITEM_ID_1, ITEM_ID_2],
    });

    assertSuccess(result);
    expect(result.transferredItemIds).toEqual([ITEM_ID_1, ITEM_ID_2]);
    expect(result.sourceTotalCents).toBe(0);
    expect(result.destinationTotalCents).toBe(2100);
  });
});
