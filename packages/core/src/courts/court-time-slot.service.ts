import { sql } from "drizzle-orm";
import type { CourtTimeSlot } from "@gestao-de-quadras/db/schema";
import { assertSchema, rows, tenantTable, type TenantContext } from "../db/tenant";

/**
 * Faixas horárias das quadras (CAD-03).
 * `priceInCents` já chega em centavos. `dayOfWeek`: 0=Segunda ... 6=Domingo.
 */

export interface CreateCourtTimeSlotInput {
  courtId: string;
  dayOfWeek: number;
  startTimeHHMM: string;
  endTimeHHMM: string;
  durationMinutes: number;
  priceInCents: number;
}

type CourtTimeSlotRow = {
  id: string;
  court_id: string;
  day_of_week: number;
  start_time_hhmm: string;
  end_time_hhmm: string;
  duration_minutes: number;
  price_in_cents: number;
  created_at: Date;
  updated_at: Date;
};

const COLUMNS = sql`id, court_id, day_of_week, start_time_hhmm, end_time_hhmm, duration_minutes, price_in_cents, created_at, updated_at`;

function toTimeSlot(row: CourtTimeSlotRow): CourtTimeSlot {
  return {
    id: row.id,
    courtId: row.court_id,
    dayOfWeek: row.day_of_week,
    startTimeHHMM: row.start_time_hhmm,
    endTimeHHMM: row.end_time_hhmm,
    durationMinutes: row.duration_minutes,
    priceInCents: row.price_in_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getTimeSlots(
  ctx: TenantContext,
  courtId: string
): Promise<CourtTimeSlot[]> {
  assertSchema(ctx.schemaName);
  const result = await ctx.db.execute<CourtTimeSlotRow>(
    sql`SELECT ${COLUMNS} FROM ${tenantTable(ctx.schemaName, "court_time_slots")}
        WHERE court_id = ${courtId}`
  );
  return rows<CourtTimeSlotRow>(result).map(toTimeSlot);
}

export async function createCourtTimeSlot(
  ctx: TenantContext,
  input: CreateCourtTimeSlotInput
): Promise<CourtTimeSlot> {
  assertSchema(ctx.schemaName);
  const result = await ctx.db.execute<CourtTimeSlotRow>(
    sql`INSERT INTO ${tenantTable(ctx.schemaName, "court_time_slots")}
          (court_id, day_of_week, start_time_hhmm, end_time_hhmm, duration_minutes, price_in_cents)
        VALUES (${input.courtId}, ${input.dayOfWeek}, ${input.startTimeHHMM},
                ${input.endTimeHHMM}, ${input.durationMinutes}, ${input.priceInCents})
        RETURNING ${COLUMNS}`
  );
  return toTimeSlot(rows<CourtTimeSlotRow>(result)[0]);
}
