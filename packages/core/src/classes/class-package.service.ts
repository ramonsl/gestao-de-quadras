import { sql } from "drizzle-orm";
import type { ClassPackage } from "@gestao-de-quadras/db/schema";
import { assertTenantId, rows, type TenantContext } from "../db/tenant";

export interface CreateClassPackageInput {
  name: string;
  totalClassCount: number;
  priceInCents: number;
}

type ClassPackageRow = {
  id: string;
  tenant_id: string;
  name: string;
  total_class_count: number;
  price_in_cents: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

const COLS = sql`id, tenant_id, name, total_class_count, price_in_cents, is_active, created_at, updated_at`;

function toClassPackage(row: ClassPackageRow): ClassPackage {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    totalClassCount: row.total_class_count,
    priceInCents: row.price_in_cents,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getClassPackages(ctx: TenantContext): Promise<ClassPackage[]> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<ClassPackageRow>(
    sql`SELECT ${COLS} FROM class_packages
        WHERE tenant_id = ${ctx.tenantId} ORDER BY created_at DESC`
  );
  return rows<ClassPackageRow>(result).map(toClassPackage);
}

export async function getActiveClassPackages(ctx: TenantContext): Promise<ClassPackage[]> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<ClassPackageRow>(
    sql`SELECT ${COLS} FROM class_packages
        WHERE tenant_id = ${ctx.tenantId} AND is_active = true ORDER BY name ASC`
  );
  return rows<ClassPackageRow>(result).map(toClassPackage);
}

export async function createClassPackage(
  ctx: TenantContext,
  input: CreateClassPackageInput
): Promise<ClassPackage> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<ClassPackageRow>(
    sql`INSERT INTO class_packages (tenant_id, name, total_class_count, price_in_cents)
        VALUES (${ctx.tenantId}, ${input.name}, ${input.totalClassCount}, ${input.priceInCents})
        RETURNING ${COLS}`
  );
  return toClassPackage(rows<ClassPackageRow>(result)[0]);
}
