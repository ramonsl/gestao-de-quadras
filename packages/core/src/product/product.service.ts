import { z } from "zod";
import { and, eq, lte, ilike, type SQL } from "drizzle-orm";
import type { TenantDbClient } from "@gestao-de-quadras/db";
import { products, stockMovements, auditLogs, type Product } from "@gestao-de-quadras/db/schema";

export const createProductInput = z.object({
  name: z.string().min(1).max(255),
  barcode: z.string().max(100).optional().nullable(),
  salePriceCents: z.number().int().positive(),
  category: z.string().min(1).max(100),
  currentStock: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(0),
});

export const updateProductInput = createProductInput.partial();

export async function createProduct(
  input: z.infer<typeof createProductInput>,
  tenantDb: TenantDbClient,
  userId?: string
): Promise<Product> {
  return tenantDb.executeInTenant(async (tx) => {
    const [p] = await tx.insert(products).values(input).returning();
    if (userId)
      await tx.insert(auditLogs).values({
        userId,
        action: "product:created",
        details: JSON.stringify({ productId: p.id, ...input }),
      });
    return p;
  });
}

export async function updateProduct(
  id: string,
  input: z.infer<typeof updateProductInput>,
  tenantDb: TenantDbClient,
  userId?: string
): Promise<Product | null> {
  return tenantDb.executeInTenant(async (tx) => {
    const [p] = await tx
      .update(products)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    if (p && userId)
      await tx.insert(auditLogs).values({
        userId,
        action: "product:updated",
        details: JSON.stringify({ productId: id, changes: input }),
      });
    return p || null;
  });
}

export async function getProductById(
  id: string,
  tenantDb: TenantDbClient
): Promise<Product | null> {
  return tenantDb.executeInTenant(async (tx) => {
    const [p] = await tx.select().from(products).where(eq(products.id, id));
    return p || null;
  });
}

export async function listProducts(
  filters: { category?: string; searchTerm?: string } | undefined,
  tenantDb: TenantDbClient
): Promise<Product[]> {
  const conditions: SQL[] = [];
  if (filters?.category) conditions.push(eq(products.category, filters.category));
  if (filters?.searchTerm) conditions.push(ilike(products.name, `%${filters.searchTerm}%`));

  return tenantDb.executeInTenant((tx) =>
    conditions.length
      ? tx.select().from(products).where(and(...conditions))
      : tx.select().from(products)
  );
}

export async function getProductsWithLowStock(
  tenantDb: TenantDbClient
): Promise<Product[]> {
  return tenantDb.executeInTenant((tx) =>
    tx.select().from(products).where(lte(products.currentStock, products.minStock))
  );
}

export async function deleteProduct(
  id: string,
  tenantDb: TenantDbClient,
  userId?: string
): Promise<boolean> {
  return tenantDb.executeInTenant(async (tx) => {
    const [p] = await tx.delete(products).where(eq(products.id, id)).returning();
    if (p && userId)
      await tx.insert(auditLogs).values({
        userId,
        action: "product:deleted",
        details: JSON.stringify({ productId: id }),
      });
    return !!p;
  });
}

export async function debitStock(
  productId: string,
  qty: number,
  reason: string,
  tenantDb: TenantDbClient,
  userId?: string
): Promise<{ success: boolean; newStock?: number; reason?: string }> {
  return tenantDb.executeInTenant(async (tx) => {
    const [p] = await tx.select().from(products).where(eq(products.id, productId));

    if (!p) {
      return { success: false, reason: "product_not_found" };
    }

    if (p.currentStock < qty) {
      return { success: false, reason: "insufficient_stock" };
    }

    const newStock = p.currentStock - qty;
    await tx
      .update(products)
      .set({ currentStock: newStock, updatedAt: new Date() })
      .where(eq(products.id, productId));
    await tx
      .insert(stockMovements)
      .values({ productId, quantityChange: -qty, reason, userId: userId || null });
    return { success: true, newStock };
  });
}
