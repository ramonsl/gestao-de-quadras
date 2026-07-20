import { z } from "zod";
import { sql } from "drizzle-orm";
import type { Product } from "@gestao-de-quadras/db/schema";
import { assertTenantId, rows, type TenantContext } from "../db/tenant";

export const createProductInput = z.object({
  name: z.string().min(1).max(255),
  barcode: z.string().max(100).optional().nullable(),
  salePriceCents: z.number().int().positive(),
  category: z.string().min(1).max(100),
  currentStock: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(0),
});

export const updateProductInput = createProductInput.partial();

type ProductRow = {
  id: string;
  tenant_id: string;
  name: string;
  barcode: string | null;
  sale_price_cents: number;
  category: string;
  current_stock: number;
  min_stock: number;
  created_at: Date;
  updated_at: Date;
};

const COLS = sql`id, tenant_id, name, barcode, sale_price_cents, category, current_stock, min_stock, created_at, updated_at`;

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    barcode: row.barcode,
    salePriceCents: row.sale_price_cents,
    category: row.category,
    currentStock: row.current_stock,
    minStock: row.min_stock,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function writeAudit(
  ctx: TenantContext,
  action: string,
  details: Record<string, unknown>
): Promise<void> {
  if (!ctx.actorUserId) return;
  await ctx.db.execute(
    sql`INSERT INTO audit_logs (tenant_id, user_id, action, details)
        VALUES (${ctx.tenantId}, ${ctx.actorUserId}, ${action}, ${JSON.stringify(details)})`
  );
}

export async function createProduct(
  input: z.infer<typeof createProductInput>,
  ctx: TenantContext
): Promise<Product> {
  assertTenantId(ctx.tenantId);
  const data = createProductInput.parse(input);
  const result = await ctx.db.execute<ProductRow>(
    sql`INSERT INTO products (tenant_id, name, barcode, sale_price_cents, category, current_stock, min_stock)
        VALUES (${ctx.tenantId}, ${data.name}, ${data.barcode ?? null}, ${data.salePriceCents},
                ${data.category}, ${data.currentStock}, ${data.minStock})
        RETURNING ${COLS}`
  );
  const product = toProduct(rows<ProductRow>(result)[0]);
  await writeAudit(ctx, "product:created", { productId: product.id, ...data });
  return product;
}

export async function updateProduct(
  id: string,
  input: z.infer<typeof updateProductInput>,
  ctx: TenantContext
): Promise<Product | null> {
  assertTenantId(ctx.tenantId);
  const data = updateProductInput.parse(input);
  const sets: ReturnType<typeof sql>[] = [];
  if (data.name !== undefined) sets.push(sql`name = ${data.name}`);
  if (data.barcode !== undefined) sets.push(sql`barcode = ${data.barcode}`);
  if (data.salePriceCents !== undefined) sets.push(sql`sale_price_cents = ${data.salePriceCents}`);
  if (data.category !== undefined) sets.push(sql`category = ${data.category}`);
  if (data.currentStock !== undefined) sets.push(sql`current_stock = ${data.currentStock}`);
  if (data.minStock !== undefined) sets.push(sql`min_stock = ${data.minStock}`);
  sets.push(sql`updated_at = now()`);

  const result = await ctx.db.execute<ProductRow>(
    sql`UPDATE products SET ${sql.join(sets, sql`, `)}
        WHERE id = ${id} AND tenant_id = ${ctx.tenantId}
        RETURNING ${COLS}`
  );
  const row = rows<ProductRow>(result)[0];
  if (!row) return null;
  await writeAudit(ctx, "product:updated", { productId: id, changes: data });
  return toProduct(row);
}

export async function getProductById(id: string, ctx: TenantContext): Promise<Product | null> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<ProductRow>(
    sql`SELECT ${COLS} FROM products WHERE id = ${id} AND tenant_id = ${ctx.tenantId} LIMIT 1`
  );
  const row = rows<ProductRow>(result)[0];
  return row ? toProduct(row) : null;
}

export async function listProducts(
  filters: { category?: string; searchTerm?: string } | undefined,
  ctx: TenantContext
): Promise<Product[]> {
  assertTenantId(ctx.tenantId);
  const conditions: ReturnType<typeof sql>[] = [sql`tenant_id = ${ctx.tenantId}`];
  if (filters?.category) conditions.push(sql`category = ${filters.category}`);
  if (filters?.searchTerm) conditions.push(sql`name ILIKE ${"%" + filters.searchTerm + "%"}`);

  const result = await ctx.db.execute<ProductRow>(
    sql`SELECT ${COLS} FROM products WHERE ${sql.join(conditions, sql` AND `)} ORDER BY name ASC`
  );
  return rows<ProductRow>(result).map(toProduct);
}

export async function getProductsWithLowStock(ctx: TenantContext): Promise<Product[]> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<ProductRow>(
    sql`SELECT ${COLS} FROM products
        WHERE tenant_id = ${ctx.tenantId} AND current_stock <= min_stock ORDER BY name ASC`
  );
  return rows<ProductRow>(result).map(toProduct);
}

export async function deleteProduct(id: string, ctx: TenantContext): Promise<boolean> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<{ id: string }>(
    sql`DELETE FROM products WHERE id = ${id} AND tenant_id = ${ctx.tenantId} RETURNING id`
  );
  const deleted = rows<{ id: string }>(result).length > 0;
  if (deleted) await writeAudit(ctx, "product:deleted", { productId: id });
  return deleted;
}

export async function debitStock(
  productId: string,
  qty: number,
  reason: string,
  ctx: TenantContext
): Promise<{ success: boolean; newStock?: number; reason?: string }> {
  assertTenantId(ctx.tenantId);
  // Débito atômico: só decrementa se houver saldo suficiente.
  const updated = await ctx.db.execute<{ current_stock: number }>(
    sql`UPDATE products
        SET current_stock = current_stock - ${qty}, updated_at = now()
        WHERE id = ${productId} AND tenant_id = ${ctx.tenantId} AND current_stock >= ${qty}
        RETURNING current_stock`
  );
  const row = rows<{ current_stock: number }>(updated)[0];
  if (!row) {
    const exists = await ctx.db.execute<{ id: string }>(
      sql`SELECT id FROM products WHERE id = ${productId} AND tenant_id = ${ctx.tenantId} LIMIT 1`
    );
    return {
      success: false,
      reason: rows<{ id: string }>(exists).length ? "insufficient_stock" : "product_not_found",
    };
  }
  await ctx.db.execute(
    sql`INSERT INTO stock_movements (tenant_id, product_id, quantity_change, reason, user_id)
        VALUES (${ctx.tenantId}, ${productId}, ${-qty}, ${reason}, ${ctx.actorUserId ?? null})`
  );
  return { success: true, newStock: row.current_stock };
}
