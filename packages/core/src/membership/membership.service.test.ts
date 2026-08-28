import { describe, expect, it } from "vitest";
import type { TenantContext } from "../db/tenant";
import {
  CreateCustomerMembershipInputSchema,
  SaveMembershipPlanInputSchema,
  calculateLineDiscount,
  closeComandaWithMembership,
  createCustomerMembership,
  getSettlementPreview,
} from "./membership.service";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "22222222-2222-4222-8222-222222222222";
const CUSTOMER_ID = "33333333-3333-4333-8333-333333333333";
const COMANDA_ID = "44444444-4444-4444-8444-444444444444";
const PLAN_ID = "55555555-5555-4555-8555-555555555555";

function queueContext(responses: unknown[][]): TenantContext {
  const queue = [...responses];
  return {
    tenantId: TENANT_ID,
    actorUserId: ACTOR_ID,
    db: {
      execute: async () => ({ rows: queue.shift() ?? [] }),
    } as unknown as TenantContext["db"],
  };
}

const planRow = {
  id: PLAN_ID,
  tenant_id: TENANT_ID,
  name: "Clube Ouro",
  description: "Benefícios da arena",
  cycle_price_cents: 15000,
  billing_period: "monthly",
  product_discount_percent: 10,
  court_rental_discount_percent: 20,
  class_package_discount_percent: 30,
  is_active: true,
  created_at: new Date("2026-08-01T00:00:00Z"),
  updated_at: new Date("2026-08-27T12:00:00Z"),
  categories: ["Bebidas"],
};

describe("FIL-01 — validação dos planos", () => {
  it("aceita valor total de ciclo inteiro e periodicidade anual", () => {
    const parsed = SaveMembershipPlanInputSchema.parse({
      name: "Anual",
      description: "Plano anual",
      cyclePriceCents: 120000,
      billingPeriod: "annual",
      productDiscountPercent: 10,
      courtRentalDiscountPercent: 15,
      classPackageDiscountPercent: 20,
      productCategories: ["Bebidas"],
    });
    expect(parsed.cyclePriceCents).toBe(120000);
  });

  it("rejeita preço zero, decimal e percentual acima de 100", () => {
    const base = {
      name: "Inválido",
      description: "Plano inválido",
      billingPeriod: "monthly",
      productDiscountPercent: 101,
      courtRentalDiscountPercent: 0,
      classPackageDiscountPercent: 0,
      productCategories: [],
    };
    expect(SaveMembershipPlanInputSchema.safeParse({ ...base, cyclePriceCents: 0 }).success).toBe(false);
    expect(SaveMembershipPlanInputSchema.safeParse({ ...base, productDiscountPercent: 10, cyclePriceCents: 10.5 }).success).toBe(false);
  });

  it("rejeita término anterior ao início", () => {
    const result = CreateCustomerMembershipInputSchema.safeParse({
      customerId: CUSTOMER_ID,
      membershipPlanId: PLAN_ID,
      startsOn: "2026-09-10",
      endsOn: "2026-09-09",
    });
    expect(result.success).toBe(false);
  });
});

describe("FIL-01 — arredondamento", () => {
  it("arredonda cada linha para o centavo mais próximo", () => {
    expect(calculateLineDiscount(105, 10)).toBe(11);
    expect(calculateLineDiscount(104, 10)).toBe(10);
  });

  it("não usa ponto flutuante para dinheiro", () => {
    expect(calculateLineDiscount(999, 33)).toBe(330);
  });
});

describe("FIL-01 — prévia do settlement", () => {
  it("aplica percentuais separados e soma os descontos arredondados por linha", async () => {
    const ctx = queueContext([
      [{ id: COMANDA_ID, customer_id: CUSTOMER_ID, status: "open" }],
      [
        { id: "item-product", item_type: "product", product_name_at_sale: "Água", category_at_sale: "Bebidas", quantity: 1, unit_price_cents_at_sale: 105 },
        { id: "item-rental", item_type: "court_rental", product_name_at_sale: "Quadra", category_at_sale: null, quantity: 1, unit_price_cents_at_sale: 1000 },
        { id: "item-class", item_type: "class_package", product_name_at_sale: "Pacote", category_at_sale: null, quantity: 1, unit_price_cents_at_sale: 2000 },
      ],
      [planRow],
    ]);
    const preview = await getSettlementPreview(ctx, COMANDA_ID);
    expect(preview?.lines.map((line) => line.discountPercent)).toEqual([10, 20, 30]);
    expect(preview?.discountTotalCents).toBe(811);
    expect(preview?.netTotalCents).toBe(2294);
    expect(preview?.settlementToken).toMatch(/^[a-f0-9]{64}$/);
  });

  it("não concede desconto a produto fora das categorias", async () => {
    const ctx = queueContext([
      [{ id: COMANDA_ID, customer_id: CUSTOMER_ID, status: "open" }],
      [{ id: "item-1", item_type: "product", product_name_at_sale: "Raquete", category_at_sale: "Loja", quantity: 1, unit_price_cents_at_sale: 10000 }],
      [planRow],
    ]);
    const preview = await getSettlementPreview(ctx, COMANDA_ID);
    expect(preview?.discountTotalCents).toBe(0);
  });

  it("não concede benefício para comanda anônima", async () => {
    const ctx = queueContext([
      [{ id: COMANDA_ID, customer_id: null, status: "open" }],
      [{ id: "item-1", item_type: "court_rental", product_name_at_sale: "Quadra", category_at_sale: null, quantity: 1, unit_price_cents_at_sale: 10000 }],
    ]);
    const preview = await getSettlementPreview(ctx, COMANDA_ID);
    expect(preview?.membershipPlanId).toBeNull();
    expect(preview?.netTotalCents).toBe(10000);
  });

  it("retorna null para comanda fechada", async () => {
    const preview = await getSettlementPreview(
      queueContext([[{ id: COMANDA_ID, customer_id: CUSTOMER_ID, status: "closed" }]]),
      COMANDA_ID
    );
    expect(preview).toBeNull();
  });

  it("bloqueia fechamento quando itens, cliente ou plano mudam após a prévia", async () => {
    const ctx = queueContext([
      [{ id: COMANDA_ID }],
      [{ id: COMANDA_ID, customer_id: CUSTOMER_ID, status: "open" }],
      [{ id: "item-1", item_type: "product", product_name_at_sale: "Água", category_at_sale: "Bebidas", quantity: 1, unit_price_cents_at_sale: 1000 }],
      [planRow],
    ]);
    const result = await closeComandaWithMembership(ctx, {
      comandaId: COMANDA_ID,
      settlementToken: "0".repeat(64),
      payments: [{ paymentMethod: "pix", amountCents: 900 }],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toBe("settlement_changed");
  });
});

describe("FIL-01 — vínculo manual", () => {
  it("vincula apenas cliente e plano ativos do mesmo tenant", async () => {
    const ctx = queueContext([
      [{ id: CUSTOMER_ID }],
      [{ id: PLAN_ID }],
      [{ id: "66666666-6666-4666-8666-666666666666" }],
      [{}],
    ]);
    const result = await createCustomerMembership(ctx, {
      customerId: CUSTOMER_ID,
      membershipPlanId: PLAN_ID,
      startsOn: "2026-09-01",
      endsOn: null,
    });
    expect(result.success).toBe(true);
  });

  it("recusa ID de cliente de outro tenant sem consultar o plano", async () => {
    const result = await createCustomerMembership(queueContext([[]]), {
      customerId: CUSTOMER_ID,
      membershipPlanId: PLAN_ID,
      startsOn: "2026-09-01",
      endsOn: null,
    });
    expect(result).toEqual({ success: false, reason: "customer_not_found" });
  });
});
