import { eq } from "drizzle-orm";
import { courts, type Court } from "@gestao-de-quadras/db/schema";
import type { TenantDbClient } from "@gestao-de-quadras/db";

/**
 * Quadras (CAD-03). Todas as queries rodam dentro de `executeInTenant`,
 * garantindo o `search_path` isolado do tenant (RNF-01 / Regra Inviolável #1).
 */

export interface CreateCourtInput {
  name: string;
  modality: string;
}

export async function getCourtsByTenant(tenantDb: TenantDbClient): Promise<Court[]> {
  return tenantDb.executeInTenant((tx) =>
    tx.select().from(courts).orderBy(courts.name)
  );
}

export async function getCourtById(
  tenantDb: TenantDbClient,
  courtId: string
): Promise<Court | null> {
  const rows = await tenantDb.executeInTenant((tx) =>
    tx.select().from(courts).where(eq(courts.id, courtId)).limit(1)
  );
  return rows[0] ?? null;
}

export async function createCourt(
  tenantDb: TenantDbClient,
  input: CreateCourtInput
): Promise<Court> {
  const rows = await tenantDb.executeInTenant((tx) =>
    tx
      .insert(courts)
      .values({ name: input.name, modality: input.modality })
      .returning()
  );
  return rows[0];
}
