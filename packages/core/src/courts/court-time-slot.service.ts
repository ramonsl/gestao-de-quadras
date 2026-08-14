import { sql } from "drizzle-orm";
import type { CourtTimeSlot } from "@gestao-de-quadras/db/schema";
import { assertTenantId, rows, type TenantContext } from "../db/tenant";
import { assertCourtInTenant } from "./court.service";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateCourtTimeSlotInput {
  courtId: string;
  dayOfWeek: number;
  startTimeHHMM: string;
  endTimeHHMM: string;
  durationMinutes: number;
  priceInCents: number;
  /** Tarifa mensalista opcional. Se omitido, usa priceInCents. */
  monthlyPriceInCents?: number | null;
}

/**
 * Regra de agenda para múltiplos dias da semana.
 * O sistema gera automaticamente os slots de 30 min no intervalo de funcionamento.
 */
export interface CourtScheduleRuleInput {
  courtId: string;
  /** Dias da semana afetados (0 = Dom, 1 = Seg, ..., 6 = Sáb). Mínimo 1. */
  days: number[];
  /** Horário de abertura, ex: "08:00" */
  openingHHMM: string;
  /** Horário de fechamento, ex: "22:00" */
  closingHHMM: string;
  /** Preço por fração de 30 minutos em centavos */
  pricePerSlotInCents: number;
  /** Tarifa mensalista opcional. Se omitido, usa priceInCents para mensalistas. */
  monthlyPriceInCents?: number | null;
}

export interface GeneratedSlot {
  startTimeHHMM: string;
  endTimeHHMM: string;
  durationMinutes: 30;
  priceInCents: number;
  monthlyPriceInCents?: number | null;
}

// ---------------------------------------------------------------------------
// Internal row type
// ---------------------------------------------------------------------------

type CourtTimeSlotRow = {
  id: string;
  tenant_id: string;
  court_id: string;
  day_of_week: number;
  start_time_hhmm: string;
  end_time_hhmm: string;
  duration_minutes: number;
  price_in_cents: number;
  monthly_price_in_cents: number | null;
  created_at: Date;
  updated_at: Date;
};

const COLS = sql`id, tenant_id, court_id, day_of_week, start_time_hhmm, end_time_hhmm, duration_minutes, price_in_cents, monthly_price_in_cents, created_at, updated_at`;

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
    monthlyPriceInCents: row.monthly_price_in_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Pure utility — testável sem I/O
// ---------------------------------------------------------------------------

/**
 * Gera a lista de slots de 30 minutos no intervalo [opening, closing).
 * Ex: opening="08:00", closing="10:00" → ["08:00–08:30", "08:30–09:00", "09:00–09:30", "09:30–10:00"]
 *
 * @throws {Error} Se o intervalo for inválido (abertura >= fechamento ou diferença < 30 min).
 */
export function generateSlotsFromRule(
  openingHHMM: string,
  closingHHMM: string,
  pricePerSlotInCents: number,
  monthlyPriceInCents?: number | null
): GeneratedSlot[] {
  const toMinutes = (hhmm: string): number => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const toHHMM = (minutes: number): string => {
    const h = Math.floor(minutes / 60)
      .toString()
      .padStart(2, "0");
    const m = (minutes % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
  };

  const startMin = toMinutes(openingHHMM);
  const endMin = toMinutes(closingHHMM);

  if (startMin >= endMin) {
    throw new Error("Horário de abertura deve ser anterior ao de fechamento.");
  }
  if (endMin - startMin < 30) {
    throw new Error(
      "O intervalo de funcionamento deve ter pelo menos 30 minutos."
    );
  }

  const slots: GeneratedSlot[] = [];
  let cursor = startMin;
  while (cursor + 30 <= endMin) {
    slots.push({
      startTimeHHMM: toHHMM(cursor),
      endTimeHHMM: toHHMM(cursor + 30),
      durationMinutes: 30,
      priceInCents: pricePerSlotInCents,
      monthlyPriceInCents: monthlyPriceInCents ?? null,
    });
    cursor += 30;
  }
  return slots;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getTimeSlots(
  ctx: TenantContext,
  courtId: string
): Promise<CourtTimeSlot[]> {
  assertTenantId(ctx.tenantId);
  const result = await ctx.db.execute<CourtTimeSlotRow>(
    sql`SELECT ${COLS} FROM court_time_slots
        WHERE tenant_id = ${ctx.tenantId} AND court_id = ${courtId}
        ORDER BY day_of_week, start_time_hhmm`
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
          (tenant_id, court_id, day_of_week, start_time_hhmm, end_time_hhmm, duration_minutes, price_in_cents, monthly_price_in_cents)
        VALUES (${ctx.tenantId}, ${input.courtId}, ${input.dayOfWeek}, ${input.startTimeHHMM},
                ${input.endTimeHHMM}, ${input.durationMinutes}, ${input.priceInCents}, ${input.monthlyPriceInCents ?? null})
        RETURNING ${COLS}`
  );
  return toTimeSlot(rows<CourtTimeSlotRow>(result)[0]);
}

/**
 * Remove todos os slots de uma quadra nos dias indicados.
 * Usado internamente pelo upsert para garantir idempotência.
 */
export async function deleteTimeSlotsByDay(
  ctx: TenantContext,
  courtId: string,
  days: number[]
): Promise<void> {
  assertTenantId(ctx.tenantId);
  if (days.length === 0) return;
  // Garante que courtId pertence ao tenant antes de deletar.
  await assertCourtInTenant(ctx, courtId);
  const dayList = sql.join(
    days.map((d) => sql`${d}`),
    sql`, `
  );
  await ctx.db.execute(
    sql`DELETE FROM court_time_slots
        WHERE tenant_id = ${ctx.tenantId}
          AND court_id = ${courtId}
          AND day_of_week IN (${dayList})`
  );
}

/**
 * Salva a grade de horários de uma quadra para os dias informados.
 *
 * Estratégia upsert:
 * 1. Deleta todos os slots existentes dos dias selecionados.
 * 2. Gera os novos slots de 30 min a partir da regra.
 * 3. Insere os novos slots em lote.
 *
 * @returns Número de slots criados.
 */
export async function upsertCourtScheduleRule(
  ctx: TenantContext,
  input: CourtScheduleRuleInput
): Promise<{ slotsCreated: number }> {
  assertTenantId(ctx.tenantId);
  if (input.days.length === 0) {
    throw new Error("Selecione pelo menos um dia da semana.");
  }

  const generatedSlots = generateSlotsFromRule(
    input.openingHHMM,
    input.closingHHMM,
    input.pricePerSlotInCents
  );

  // Step 1: remove slots existentes dos dias afetados.
  await deleteTimeSlotsByDay(ctx, input.courtId, input.days);

  if (generatedSlots.length === 0) {
    return { slotsCreated: 0 };
  }

  // Step 2: insere novos slots para cada dia × cada slot gerado.
  let slotsCreated = 0;
  for (const day of input.days) {
    for (const slot of generatedSlots) {
      await ctx.db.execute(
        sql`INSERT INTO court_time_slots
              (tenant_id, court_id, day_of_week, start_time_hhmm, end_time_hhmm, duration_minutes, price_in_cents, monthly_price_in_cents)
            VALUES (${ctx.tenantId}, ${input.courtId}, ${day}, ${slot.startTimeHHMM},
                    ${slot.endTimeHHMM}, ${slot.durationMinutes}, ${slot.priceInCents}, ${input.monthlyPriceInCents ?? null})`
      );
      slotsCreated++;
    }
  }

  return { slotsCreated };
}
