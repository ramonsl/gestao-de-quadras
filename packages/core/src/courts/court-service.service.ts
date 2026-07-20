import { eq } from "drizzle-orm";
import { courtServices, type CourtService } from "@gestao-de-quadras/db/schema";
import type { TenantDbClient } from "@gestao-de-quadras/db";

/**
 * Serviços de quadra (CAD-03): locação, aula avulsa, pacote.
 * `basePriceInCents` já chega em centavos (integer).
 */

export interface CreateCourtServiceInput {
  courtId: string;
  serviceType: "rental" | "single_class" | "package";
  basePriceInCents: number;
}

export async function getCourtServices(
  tenantDb: TenantDbClient,
  courtId: string
): Promise<CourtService[]> {
  return tenantDb.executeInTenant((tx) =>
    tx.select().from(courtServices).where(eq(courtServices.courtId, courtId))
  );
}

export async function createCourtService(
  tenantDb: TenantDbClient,
  input: CreateCourtServiceInput
): Promise<CourtService> {
  const rows = await tenantDb.executeInTenant((tx) =>
    tx
      .insert(courtServices)
      .values({
        courtId: input.courtId,
        serviceType: input.serviceType,
        basePriceInCents: input.basePriceInCents,
      })
      .returning()
  );
  return rows[0];
}
