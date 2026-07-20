import { sql } from "drizzle-orm";
import type { CourtTimeSlot } from "@gestao-de-quadras/db/schema";
import { assertTenantId, rows, type TenantContext } from "../db/tenant";
import { assertCourtInTenant } from "./court.service";

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
  tenant_id: string;
  court_id: string;
  day_of_week: number;
  start_time_hhmm: string;
  end_time_hhmm: string;
  duration_minutes: number;
  price_in_cents: number;
  created_at: Date;
  updated_at: Date;
};

const COLS = sql`id, tenant_id, court_id, day_of_week, start_time_hhmm, end_time_hhmm, duration_minutes, price_in_cents, created_at, updated_at`;

function toTimeSlot(row: CourtTimeSlotRow): CourtTimeSlot {
  return {
    id: row.id,
    tenantId: row.tenant_id,
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
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<CourtTimeSlotRow>(
    sql`SELECT ${COLS} FROM court_time_slots
        WHERE tenant_id = ${ctx.tenantId} AND court_id = ${courtId}`
  );
  return rows<CourtTimeSlotRow>(result).map(toTimeSlot);
}

export async function createCourtTimeSlot(
  ctx: TenantContext,
  input: CreateCourtTimeSlotInput
): Promise<CourtTimeSlot> {
  assertTenantId(ctx.tenantId);
  // Anti-IDOR: o courtId vem do formulário — revalida que é do tenant da sessão.
  await assertCourtInTenant(ctx, input.courtId);
  const result = await ctx.db.execute<CourtTimeSlotRow>(
    sql`INSERT INTO court_time_slots
          (tenant_id, court_id, day_of_week, start_time_hhmm, end_time_hhmm, duration_minutes, price_in_cents)
        VALUES (${ctx.tenantId}, ${input.courtId}, ${input.dayOfWeek}, ${input.startTimeHHMM},
                ${input.endTimeHHMM}, ${input.durationMinutes}, ${input.priceInCents})
        RETURNING ${COLS}`
  );
  return toTimeSlot(rows<CourtTimeSlotRow>(result)[0]);
}
