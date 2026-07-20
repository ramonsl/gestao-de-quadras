import { desc } from "drizzle-orm";
import { classPackages, type ClassPackage } from "@gestao-de-quadras/db/schema";
import type { TenantDbClient } from "@gestao-de-quadras/db";

/**
 * Pacotes de aulas (CAD-03). `priceInCents` já chega em centavos (integer).
 */

export interface CreateClassPackageInput {
  name: string;
  totalClassCount: number;
  priceInCents: number;
}

export async function getClassPackages(
  tenantDb: TenantDbClient
): Promise<ClassPackage[]> {
  return tenantDb.executeInTenant((tx) =>
    tx.select().from(classPackages).orderBy(desc(classPackages.createdAt))
  );
}

export async function createClassPackage(
  tenantDb: TenantDbClient,
  input: CreateClassPackageInput
): Promise<ClassPackage> {
  const rows = await tenantDb.executeInTenant((tx) =>
    tx
      .insert(classPackages)
      .values({
        name: input.name,
        totalClassCount: input.totalClassCount,
        priceInCents: input.priceInCents,
      })
      .returning()
  );
  return rows[0];
}
