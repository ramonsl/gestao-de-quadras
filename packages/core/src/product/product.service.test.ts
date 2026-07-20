import { describe, it, expect } from "vitest";
import {
  createProduct,
  updateProduct,
  getProductById,
  listProducts,
  getProductsWithLowStock,
  deleteProduct,
  debitStock,
} from "./product.service";

/**
 * Contexto de tenant com `db.execute` sequencial: cada chamada consome o
 * próximo conjunto de linhas (snake_case, como o Postgres retorna).
 */
const ctx = (rowSets: unknown[][]) => {
  let i = 0;
  return {
    db: { execute: async () => ({ rows: rowSets[i++] ?? [] }) },
    schemaName: "tenant_arena-x",
    actorUserId: "user-1",
  } as any;
};

const productRow = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  name: "Água",
  barcode: null,
  sale_price_cents: 500,
  category: "bebidas",
  current_stock: 10,
  min_stock: 2,
  created_at: new Date(),
  updated_at: new Date(),
  ...over,
});

describe("Product Service", () => {
  describe("assertSchema", () => {
    it("rejeita schema de tenant inválido", async () => {
      await expect(
        listProducts(undefined, { db: {}, schemaName: "public; DROP" } as any)
      ).rejects.toThrow(/schema de tenant inválido/i);
    });
  });

  describe("createProduct", () => {
    it("cria produto e retorna no formato camelCase", async () => {
      const c = ctx([[productRow()]]);
      const result = await createProduct(
        { name: "Água", salePriceCents: 500, category: "bebidas", currentStock: 10, minStock: 2 },
        c
      );
      expect(result.id).toBe("p1");
      expect(result.salePriceCents).toBe(500);
      expect(result.currentStock).toBe(10);
    });

    it("rejeita preço não positivo (validação Zod)", async () => {
      await expect(
        createProduct({ name: "X", salePriceCents: 0, category: "bebidas" } as any, ctx([[]]))
      ).rejects.toThrow();
    });
  });

  describe("updateProduct", () => {
    it("atualiza e retorna o produto", async () => {
      const result = await updateProduct("p1", { salePriceCents: 700 }, ctx([[productRow({ sale_price_cents: 700 })]]));
      expect(result?.salePriceCents).toBe(700);
    });

    it("retorna null quando o produto não existe", async () => {
      const result = await updateProduct("nope", { category: "lanches" }, ctx([[]]));
      expect(result).toBeNull();
    });
  });

  describe("getProductById", () => {
    it("retorna o produto quando existe", async () => {
      const result = await getProductById("p1", ctx([[productRow()]]));
      expect(result?.id).toBe("p1");
    });

    it("retorna null quando não existe", async () => {
      const result = await getProductById("nope", ctx([[]]));
      expect(result).toBeNull();
    });
  });

  describe("listProducts / low stock", () => {
    it("lista e mapeia os produtos", async () => {
      const result = await listProducts({ category: "bebidas", searchTerm: "agua" }, ctx([[productRow(), productRow({ id: "p2" })]]));
      expect(result).toHaveLength(2);
      expect(result[0].category).toBe("bebidas");
    });

    it("retorna produtos com estoque baixo", async () => {
      const result = await getProductsWithLowStock(ctx([[productRow({ current_stock: 1, min_stock: 2 })]]));
      expect(result).toHaveLength(1);
    });
  });

  describe("deleteProduct", () => {
    it("retorna true quando deletou", async () => {
      expect(await deleteProduct("p1", ctx([[{ id: "p1" }]]))).toBe(true);
    });

    it("retorna false quando não encontrou", async () => {
      expect(await deleteProduct("nope", ctx([[]]))).toBe(false);
    });
  });

  describe("debitStock", () => {
    it("debita com saldo suficiente", async () => {
      const result = await debitStock("p1", 6, "sale", ctx([[{ current_stock: 4 }]]));
      expect(result).toEqual({ success: true, newStock: 4 });
    });

    it("falha com estoque insuficiente", async () => {
      // UPDATE não retorna linha (WHERE current_stock >= qty falhou) + SELECT acha o produto
      const result = await debitStock("p1", 999, "sale", ctx([[], [{ id: "p1" }]]));
      expect(result).toEqual({ success: false, reason: "insufficient_stock" });
    });

    it("falha quando o produto não existe", async () => {
      const result = await debitStock("nope", 1, "sale", ctx([[], []]));
      expect(result).toEqual({ success: false, reason: "product_not_found" });
    });
  });
});
