import { eq } from "drizzle-orm";
import { courtTimeSlots, type CourtTimeSlot } from "@gestao-de-quadras/db/schema";
import type { TenantDbClient } from "@gestao-de-quadras/db";

/**
 * Faixas horárias das quadras (CAD-03).
 * `priceInCents` já chega em centavos (integer). `dayOfWeek`: 0=Segunda ... 6=Domingo.
 */

export interface CreateCourtTimeSlotInput {
  courtId: string;
  dayOfWeek: number;
  startTimeHHMM: string;
  endTimeHHMM: string;
  durationMinutes: number;
  priceInCents: number;
}

export async function getTimeSlots(
  tenantDb: TenantDbClient,
  courtId: string
): Promise<CourtTimeSlot[]> {
  return tenantDb.executeInTenant((tx) =>
    tx.select().from(courtTimeSlots).where(eq(courtTimeSlots.courtId, courtId))
  );
}

export async function createCourtTimeSlot(
  tenantDb: TenantDbClient,
  input: CreateCourtTimeSlotInput
): Promise<CourtTimeSlot> {
  const rows = await tenantDb.executeInTenant((tx) =>
    tx
      .insert(courtTimeSlots)
      .values({
        courtId: input.courtId,
        dayOfWeek: input.dayOfWeek,
        startTimeHHMM: input.startTimeHHMM,
        endTimeHHMM: input.endTimeHHMM,
        durationMinutes: input.durationMinutes,
        priceInCents: input.priceInCents,
      })
      .returning()
  );
  return rows[0];
}
