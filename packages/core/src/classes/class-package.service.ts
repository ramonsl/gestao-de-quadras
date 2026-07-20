import { sql } from "drizzle-orm";
import type { ClassPackage } from "@gestao-de-quadras/db/schema";
import { assertSchema, rows, tenantTable, type TenantContext } from "../db/tenant";

/**
 * Pacotes de aulas (CAD-03). `priceInCents` já chega em centavos (integer).
 */

export interface CreateClassPackageInput {
  name: string;
  totalClassCount: number;
  priceInCents: number;
}

type ClassPackageRow = {
  id: string;
  name: string;
  total_class_count: number;
  price_in_cents: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

const COLUMNS = sql`id, name, total_class_count, price_in_cents, is_active, created_at, updated_at`;

function toClassPackage(row: ClassPackageRow): ClassPackage {
  return {
    id: row.id,
    name: row.name,
    totalClassCount: row.total_class_count,
    priceInCents: row.price_in_cents,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getClassPackages(ctx: TenantContext): Promise<ClassPackage[]> {
  assertSchema(ctx.schemaName);
  const result = await ctx.db.execute<ClassPackageRow>(
    sql`SELECT ${COLUMNS} FROM ${tenantTable(ctx.schemaName, "class_packages")}
        ORDER BY created_at DESC`
  );
  return rows<ClassPackageRow>(result).map(toClassPackage);
}

export async function createClassPackage(
  ctx: TenantContext,
  input: CreateClassPackageInput
): Promise<ClassPackage> {
  assertSchema(ctx.schemaName);
  const result = await ctx.db.execute<ClassPackageRow>(
    sql`INSERT INTO ${tenantTable(ctx.schemaName, "class_packages")}
          (name, total_class_count, price_in_cents)
        VALUES (${input.name}, ${input.totalClassCount}, ${input.priceInCents})
        RETURNING ${COLUMNS}`
  );
  return toClassPackage(rows<ClassPackageRow>(result)[0]);
}
