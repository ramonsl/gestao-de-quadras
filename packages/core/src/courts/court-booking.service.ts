import { z } from "zod";
import { sql } from "drizzle-orm";
import { assertTenantId, rows, type TenantContext } from "../db/tenant";
import { getCourtById } from "./court.service";
import { openComanda } from "../pdv/comanda.service";

/**
 * PDV-05 — Grade Visual de Locação de Quadras.
 *
 * A locação (`court_bookings`) é registrada como uma marcação na grade e, quando
 * vinculada a uma comanda, gera uma LINHA de comanda (`item_type='court_rental'`)
 * com snapshot de nome/preço (regras 6 e 10). A dupla-marcação é impedida de
 * forma RÍGIDA pelo índice único parcial `court_bookings_no_double_idx` (AC4);
 * a checagem na aplicação é apenas para mensagem amigável. Todas as queries
 * filtram `tenant_id` (regra 1) e o `courtId`/`comandaId` vindos do cliente são
 * revalidados no tenant (anti-IDOR, regra 1b).
 */

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_REGEX = /^\d{2}:\d{2}$/;

/** Código Postgres de violação de unicidade (índice único parcial). */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "23505"
  );
}

/** 0 = Domingo … 6 = Sábado (mesma convenção de `court_time_slots.day_of_week`). */
function dayOfWeekOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function todayLocalStr(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

// --- Leitura da grade (AC1, AC2) --------------------------------------------

export type CourtSlotStatus = "free" | "booked" | "reserved";

export interface CourtBookingSplitParticipant {
  comandaId: string | null;
  customerName: string | null;
  shareCents: number;
}

export interface CourtGridSlotCell {
  courtId: string;
  startTimeHHMM: string;
  endTimeHHMM: string;
  priceInCents: number;
  status: CourtSlotStatus;
  bookingId: string | null;
  comandaId: string | null;
  customerName: string | null;
  isMonthly: boolean;
  /** Participantes quando a locação foi rateada entre múltiplas comandas. */
  splitParticipants: CourtBookingSplitParticipant[];
}

export interface CourtGridColumn {
  courtId: string;
  courtName: string;
}

export interface CourtGrid {
  date: string;
  courts: CourtGridColumn[];
  rowStartTimes: string[];
  cells: CourtGridSlotCell[];
}

export const GetCourtGridInputSchema = z.object({
  date: z.string().regex(DATE_REGEX, "Data inválida (use YYYY-MM-DD)."),
});

type CourtRow = { id: string; name: string };
type SlotRow = {
  court_id: string;
  start_time_hhmm: string;
  end_time_hhmm: string;
  price_in_cents: number;
};
type BookingRow = {
  id: string;
  court_id: string;
  start_time_hhmm: string;
  end_time_hhmm: string;
  price_cents_at_booking: number;
  status: string;
  comanda_id: string | null;
  customer_name: string | null;
  is_monthly: boolean;
};

type SplitRow = {
  court_booking_id: string;
  comanda_id: string | null;
  customer_name: string | null;
  share_cents: number;
};

/**
 * Monta a grade (quadras × horários) de uma data: colunas = quadras ativas,
 * linhas = horários configurados (união dos `start_time_hhmm` do dia da semana),
 * células com status Livre / Ocupado / Reservado. Somente leitura.
 */
export async function getCourtGridForDate(
  ctx: TenantContext,
  input: z.infer<typeof GetCourtGridInputSchema>
): Promise<CourtGrid> {
  assertTenantId(ctx.tenantId);
  const { date } = GetCourtGridInputSchema.parse(input);
  const dow = dayOfWeekOf(date);

  const [courtsResult, slotsResult, bookingsResult, splitsResult] = await Promise.all([
    ctx.db.execute<CourtRow>(
      sql`SELECT id, name FROM courts
          WHERE tenant_id = ${ctx.tenantId} AND is_active = true
          ORDER BY name ASC`
    ),
    ctx.db.execute<SlotRow>(
      sql`SELECT court_id, start_time_hhmm, end_time_hhmm, price_in_cents
          FROM court_time_slots
          WHERE tenant_id = ${ctx.tenantId} AND day_of_week = ${dow}`
    ),
    ctx.db.execute<BookingRow>(
      sql`SELECT cb.id, cb.court_id, cb.start_time_hhmm, cb.end_time_hhmm,
                 cb.price_cents_at_booking, cb.status, cb.comanda_id, cb.is_monthly, c.name AS customer_name
          FROM court_bookings cb
          LEFT JOIN customers c ON c.id = cb.customer_id AND c.tenant_id = cb.tenant_id
          WHERE cb.tenant_id = ${ctx.tenantId}
            AND cb.booking_date = ${date}
            AND cb.status <> 'cancelled'`
    ),
    ctx.db.execute<SplitRow>(
      sql`SELECT cbs.court_booking_id, cbs.comanda_id, c.name AS customer_name, cbs.share_cents
          FROM court_booking_splits cbs
          LEFT JOIN customers c ON c.id = cbs.customer_id AND c.tenant_id = cbs.tenant_id
          WHERE cbs.tenant_id = ${ctx.tenantId}
            AND cbs.court_booking_id IN (
              SELECT id FROM court_bookings
              WHERE tenant_id = ${ctx.tenantId}
                AND booking_date = ${date}
                AND status <> 'cancelled'
            )`
    ),
  ]);

  const courts = rows<CourtRow>(courtsResult).map((c) => ({ courtId: c.id, courtName: c.name }));
  const slots = rows<SlotRow>(slotsResult);
  const bookings = rows<BookingRow>(bookingsResult);
  const splits = rows<SplitRow>(splitsResult);

  const splitsByBookingId = new Map<string, CourtBookingSplitParticipant[]>();
  for (const s of splits) {
    const arr = splitsByBookingId.get(s.court_booking_id) ?? [];
    arr.push({ comandaId: s.comanda_id, customerName: s.customer_name, shareCents: s.share_cents });
    splitsByBookingId.set(s.court_booking_id, arr);
  }

  const key = (courtId: string, start: string) => `${courtId}|${start}`;
  const bookingByKey = new Map<string, BookingRow>();
  for (const b of bookings) bookingByKey.set(key(b.court_id, b.start_time_hhmm), b);

  const cellByKey = new Map<string, CourtGridSlotCell>();
  const rowSet = new Set<string>();

  for (const s of slots) {
    const b = bookingByKey.get(key(s.court_id, s.start_time_hhmm));
    const status: CourtSlotStatus = b ? (b.status === "reserved" ? "reserved" : "booked") : "free";
    cellByKey.set(key(s.court_id, s.start_time_hhmm), {
      courtId: s.court_id,
      startTimeHHMM: s.start_time_hhmm,
      endTimeHHMM: s.end_time_hhmm,
      priceInCents: s.price_in_cents,
      status,
      bookingId: b?.id ?? null,
      comandaId: b?.comanda_id ?? null,
      customerName: b?.customer_name ?? null,
      isMonthly: b?.is_monthly ?? false,
      splitParticipants: b ? (splitsByBookingId.get(b.id) ?? []) : [],
    });
    rowSet.add(s.start_time_hhmm);
  }

  // Marcações órfãs de faixa (config mudou depois): ainda precisam aparecer ocupadas.
  for (const b of bookings) {
    const k = key(b.court_id, b.start_time_hhmm);
    if (cellByKey.has(k)) continue;
    cellByKey.set(k, {
      courtId: b.court_id,
      startTimeHHMM: b.start_time_hhmm,
      endTimeHHMM: b.end_time_hhmm,
      priceInCents: b.price_cents_at_booking,
      status: b.status === "reserved" ? "reserved" : "booked",
      bookingId: b.id,
      comandaId: b.comanda_id,
      customerName: b.customer_name,
      isMonthly: b.is_monthly ?? false,
      splitParticipants: splitsByBookingId.get(b.id) ?? [],
    });
    rowSet.add(b.start_time_hhmm);
  }

  const rowStartTimes = Array.from(rowSet).sort();

  return { date, courts, rowStartTimes, cells: Array.from(cellByKey.values()) };
}

// --- Criação da locação (AC3) -----------------------------------------------

export function getRemainingWeekdayDatesInMonth(dateStr: string): string[] {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const targetDow = d.getUTCDay();

  const dates: string[] = [];
  const cursor = new Date(Date.UTC(year, month, 1));
  while (cursor.getUTCMonth() === month) {
    if (cursor.getUTCDay() === targetDow) {
      const formatted = cursor.toISOString().slice(0, 10);
      if (formatted >= dateStr) {
        dates.push(formatted);
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

type ResolvedSlot = {
  slotId: string;
  endTimeHHMM: string;
  priceInCents: number;
  monthlyPriceInCents: number | null;
};

async function resolveSlot(
  ctx: TenantContext,
  courtId: string,
  date: string,
  startTimeHHMM: string
): Promise<ResolvedSlot | null> {
  const result = await ctx.db.execute<{
    id: string;
    end_time_hhmm: string;
    price_in_cents: number;
    monthly_price_in_cents: number | null;
  }>(
    sql`SELECT id, end_time_hhmm, price_in_cents, monthly_price_in_cents FROM court_time_slots
        WHERE tenant_id = ${ctx.tenantId}
          AND court_id = ${courtId}
          AND day_of_week = ${dayOfWeekOf(date)}
          AND start_time_hhmm = ${startTimeHHMM}
        LIMIT 1`
  );
  const row = rows<{
    id: string;
    end_time_hhmm: string;
    price_in_cents: number;
    monthly_price_in_cents: number | null;
  }>(result)[0];
  return row
    ? {
        slotId: row.id,
        endTimeHHMM: row.end_time_hhmm,
        priceInCents: row.price_in_cents,
        monthlyPriceInCents: row.monthly_price_in_cents,
      }
    : null;
}

async function insertRentalLine(
  ctx: TenantContext,
  args: {
    comandaId: string;
    bookingId: string;
    courtName: string;
    startTimeHHMM: string;
    endTimeHHMM: string;
    priceInCents: number;
  }
): Promise<void> {
  const name = `Locação ${args.courtName} — ${args.startTimeHHMM}–${args.endTimeHHMM}`;
  await ctx.db.execute(
    sql`INSERT INTO comanda_items
          (tenant_id, comanda_id, item_type, product_id, court_booking_id,
           product_name_at_sale, quantity, unit_price_cents_at_sale, operator_user_id)
        VALUES (${ctx.tenantId}, ${args.comandaId}, 'court_rental', NULL, ${args.bookingId},
                ${name}, 1, ${args.priceInCents}, ${ctx.actorUserId})`
  );
}

async function reserveRecurringMonthlyDates(
  ctx: TenantContext,
  args: {
    courtId: string;
    startDate: string;
    startTimeHHMM: string;
    customerId?: string | null;
  }
): Promise<number> {
  const futureDates = getRemainingWeekdayDatesInMonth(args.startDate).filter(
    (d) => d > args.startDate
  );
  let createdCount = 0;
  for (const futureDate of futureDates) {
    const futureSlot = await resolveSlot(ctx, args.courtId, futureDate, args.startTimeHHMM);
    if (!futureSlot) continue;
    const price = futureSlot.monthlyPriceInCents ?? futureSlot.priceInCents;
    try {
      await ctx.db.execute(
        sql`INSERT INTO court_bookings
              (tenant_id, court_id, court_time_slot_id, booking_date, start_time_hhmm,
               end_time_hhmm, price_cents_at_booking, status, comanda_id, customer_id, is_monthly, created_by_user_id)
            VALUES (${ctx.tenantId}, ${args.courtId}, ${futureSlot.slotId}, ${futureDate}, ${args.startTimeHHMM},
                    ${futureSlot.endTimeHHMM}, ${price}, 'booked', NULL, ${args.customerId ?? null}, true, ${ctx.actorUserId})`
      );
      createdCount++;
    } catch (err) {
      // Só ignora a dupla-marcação esperada (índice único); erros reais sobem.
      if (!isUniqueViolation(err)) throw err;
    }
  }
  return createdCount;
}

export const CreateCourtBookingInputSchema = z.object({
  courtId: z.string().uuid(),
  date: z.string().regex(DATE_REGEX),
  startTimeHHMM: z.string().regex(HHMM_REGEX),
  customerId: z.string().uuid().nullable().optional(),
  /** Se for mensalismo, faz a reserva recorrente para todas as semanas restantes do mês (CAD-09). */
  isMonthly: z.boolean().optional().default(false),
});

export type CreateCourtBookingResult =
  | { success: true; bookingId: string; comandaId: string }
  | {
      success: false;
      reason:
        | "court_not_found"
        | "slot_not_found"
        | "past_date"
        | "double_booked"
        | "customer_not_found"
        | "already_has_open_comanda";
      existingComandaId?: string;
    };

/**
 * AC3 (nova comanda): cria a locação, abre uma comanda nova (reusa a regra
 * "1 comanda aberta por cliente") e lança a locação como linha de comanda.
 */
export async function createCourtBookingWithNewComanda(
  ctx: TenantContext,
  input: z.infer<typeof CreateCourtBookingInputSchema>,
  now: Date = new Date()
): Promise<CreateCourtBookingResult> {
  assertTenantId(ctx.tenantId);
  if (!ctx.actorUserId) {
    throw new Error("createCourtBookingWithNewComanda exige ctx.actorUserId.");
  }
  const data = CreateCourtBookingInputSchema.parse(input);

  const court = await getCourtById(ctx, data.courtId); // anti-IDOR
  if (!court) return { success: false, reason: "court_not_found" };
  if (data.date < todayLocalStr(now)) return { success: false, reason: "past_date" };

  const slot = await resolveSlot(ctx, data.courtId, data.date, data.startTimeHHMM);
  if (!slot) return { success: false, reason: "slot_not_found" };
  // Tarifa mensalista aplicada já na 1ª ocorrência quando isMonthly (CAD-05/CAD-09).
  const effectivePriceCents = data.isMonthly ? slot.monthlyPriceInCents ?? slot.priceInCents : slot.priceInCents;

  // Insere a marcação PRIMEIRO — o índice único parcial é a guarda rígida (AC4).
  let bookingId: string;
  try {
    const bookingResult = await ctx.db.execute<{ id: string }>(
      sql`INSERT INTO court_bookings
            (tenant_id, court_id, court_time_slot_id, booking_date, start_time_hhmm,
             end_time_hhmm, price_cents_at_booking, status, comanda_id, customer_id, is_monthly, created_by_user_id)
          VALUES (${ctx.tenantId}, ${data.courtId}, ${slot.slotId}, ${data.date}, ${data.startTimeHHMM},
                  ${slot.endTimeHHMM}, ${effectivePriceCents}, 'booked', NULL, ${data.customerId ?? null}, ${data.isMonthly}, ${ctx.actorUserId})
          RETURNING id`
    );
    bookingId = rows<{ id: string }>(bookingResult)[0].id;
  } catch (err) {
    if (isUniqueViolation(err)) return { success: false, reason: "double_booked" };
    throw err;
  }

  const openRes = await openComanda(ctx, { customerId: data.customerId ?? null });
  if (!openRes.success) {
    // Sem transação (neon-http): desfaz a marcação órfã antes de retornar.
    await ctx.db.execute(
      sql`DELETE FROM court_bookings WHERE id = ${bookingId} AND tenant_id = ${ctx.tenantId}`
    );
    if (openRes.reason === "customer_not_found") {
      return { success: false, reason: "customer_not_found" };
    }
    return {
      success: false,
      reason: "already_has_open_comanda",
      existingComandaId: openRes.existingComandaId,
    };
  }

  const comandaId = openRes.comanda.id;
  await ctx.db.execute(
    sql`UPDATE court_bookings SET comanda_id = ${comandaId}, updated_at = now()
        WHERE id = ${bookingId} AND tenant_id = ${ctx.tenantId}`
  );
  await insertRentalLine(ctx, {
    comandaId,
    bookingId,
    courtName: court.name,
    startTimeHHMM: data.startTimeHHMM,
    endTimeHHMM: slot.endTimeHHMM,
    priceInCents: effectivePriceCents,
  });
  await writeAudit(ctx, "pdv.court_booking.created", {
    bookingId,
    comandaId,
    courtId: data.courtId,
    date: data.date,
    startTimeHHMM: data.startTimeHHMM,
    isMonthly: data.isMonthly,
  });

  if (data.isMonthly) {
    await reserveRecurringMonthlyDates(ctx, {
      courtId: data.courtId,
      startDate: data.date,
      startTimeHHMM: data.startTimeHHMM,
      customerId: data.customerId ?? null,
    });
  }

  return { success: true, bookingId, comandaId };
}

export const AddCourtBookingToComandaInputSchema = z.object({
  courtId: z.string().uuid(),
  date: z.string().regex(DATE_REGEX),
  startTimeHHMM: z.string().regex(HHMM_REGEX),
  comandaId: z.string().uuid(),
  isMonthly: z.boolean().optional().default(false),
});

export type AddCourtBookingToComandaResult =
  | { success: true; bookingId: string }
  | {
      success: false;
      reason: "court_not_found" | "slot_not_found" | "past_date" | "double_booked" | "comanda_not_found" | "comanda_closed";
    };

/**
 * AC3 (comanda existente): adiciona a locação a uma comanda ABERTA do tenant.
 */
export async function addCourtBookingToExistingComanda(
  ctx: TenantContext,
  input: z.infer<typeof AddCourtBookingToComandaInputSchema>,
  now: Date = new Date()
): Promise<AddCourtBookingToComandaResult> {
  assertTenantId(ctx.tenantId);
  if (!ctx.actorUserId) {
    throw new Error("addCourtBookingToExistingComanda exige ctx.actorUserId.");
  }
  const data = AddCourtBookingToComandaInputSchema.parse(input);

  const court = await getCourtById(ctx, data.courtId); // anti-IDOR
  if (!court) return { success: false, reason: "court_not_found" };
  if (data.date < todayLocalStr(now)) return { success: false, reason: "past_date" };

  // Revalida a comanda no tenant (anti-IDOR) e o status aberto.
  const comandaResult = await ctx.db.execute<{ status: string; customer_id: string | null }>(
    sql`SELECT status, customer_id FROM comandas
        WHERE id = ${data.comandaId} AND tenant_id = ${ctx.tenantId} LIMIT 1`
  );
  const comanda = rows<{ status: string; customer_id: string | null }>(comandaResult)[0];
  if (!comanda) return { success: false, reason: "comanda_not_found" };
  if (comanda.status !== "open") return { success: false, reason: "comanda_closed" };

  const slot = await resolveSlot(ctx, data.courtId, data.date, data.startTimeHHMM);
  if (!slot) return { success: false, reason: "slot_not_found" };
  const effectivePriceCents = data.isMonthly ? slot.monthlyPriceInCents ?? slot.priceInCents : slot.priceInCents;

  let bookingId: string;
  try {
    const bookingResult = await ctx.db.execute<{ id: string }>(
      sql`INSERT INTO court_bookings
            (tenant_id, court_id, court_time_slot_id, booking_date, start_time_hhmm,
             end_time_hhmm, price_cents_at_booking, status, comanda_id, customer_id, is_monthly, created_by_user_id)
          VALUES (${ctx.tenantId}, ${data.courtId}, ${slot.slotId}, ${data.date}, ${data.startTimeHHMM},
                  ${slot.endTimeHHMM}, ${effectivePriceCents}, 'booked', ${data.comandaId}, ${comanda.customer_id}, ${data.isMonthly}, ${ctx.actorUserId})
          RETURNING id`
    );
    bookingId = rows<{ id: string }>(bookingResult)[0].id;
  } catch (err) {
    if (isUniqueViolation(err)) return { success: false, reason: "double_booked" };
    throw err;
  }

  await insertRentalLine(ctx, {
    comandaId: data.comandaId,
    bookingId,
    courtName: court.name,
    startTimeHHMM: data.startTimeHHMM,
    endTimeHHMM: slot.endTimeHHMM,
    priceInCents: effectivePriceCents,
  });
  await writeAudit(ctx, "pdv.court_booking.added_to_comanda", {
    bookingId,
    comandaId: data.comandaId,
    courtId: data.courtId,
    date: data.date,
    startTimeHHMM: data.startTimeHHMM,
    isMonthly: data.isMonthly,
  });

  if (data.isMonthly) {
    await reserveRecurringMonthlyDates(ctx, {
      courtId: data.courtId,
      startDate: data.date,
      startTimeHHMM: data.startTimeHHMM,
      customerId: comanda.customer_id,
    });
  }

  return { success: true, bookingId };
}

// --- Rateio de locação entre múltiplas comandas (PDV-05 AC3 — split) ---------

export const SplitParticipantSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("existing"),
    comandaId: z.string().uuid(),
  }),
  z.object({
    type: z.literal("new"),
    customerId: z.string().uuid().nullable().optional(),
    customerName: z.string().max(120).optional(),
  }),
]);

export const SplitCourtBookingInputSchema = z.object({
  courtId: z.string().uuid(),
  date: z.string().regex(DATE_REGEX),
  startTimeHHMM: z.string().regex(HHMM_REGEX),
  /** Participantes do rateio (mínimo 2): comandas abertas ou novas comandas para clientes. */
  participants: z.array(SplitParticipantSchema).min(2, "Informe ao menos 2 participantes para rateio."),
  isMonthly: z.boolean().optional().default(false),
});

export type SplitCourtBookingResult =
  | { success: true; bookingId: string; splitIds: string[] }
  | {
      success: false;
      reason:
        | "court_not_found"
        | "slot_not_found"
        | "past_date"
        | "double_booked"
        | "comanda_not_found"
        | "comanda_closed"
        | "customer_not_found";
      invalidComandaId?: string;
    };

/**
 * PDV-05 — Rateio entre múltiplas comandas (Divisão de Conta com Comandas Abertas ou Novas).
 *
 * Cria 1 `court_booking` (ocupa a grade — guarda anti-double-booking) e divide
 * o valor total igualmente entre N participantes (comandas existentes ou novas comandas abertas na hora).
 */
export async function splitCourtBookingAcrossComandas(
  ctx: TenantContext,
  input: z.infer<typeof SplitCourtBookingInputSchema>,
  now: Date = new Date()
): Promise<SplitCourtBookingResult> {
  assertTenantId(ctx.tenantId);
  if (!ctx.actorUserId) {
    throw new Error("splitCourtBookingAcrossComandas exige ctx.actorUserId.");
  }
  const data = SplitCourtBookingInputSchema.parse(input);

  const court = await getCourtById(ctx, data.courtId);
  if (!court) return { success: false, reason: "court_not_found" };
  if (data.date < todayLocalStr(now)) return { success: false, reason: "past_date" };

  const slot = await resolveSlot(ctx, data.courtId, data.date, data.startTimeHHMM);
  if (!slot) return { success: false, reason: "slot_not_found" };
  const effectivePriceCents = data.isMonthly ? slot.monthlyPriceInCents ?? slot.priceInCents : slot.priceInCents;

  // Valida e resolve as comandas (existentes ou abre novas para quem precisa).
  type ComandaInfo = { id: string; customerId: string | null };
  const comandaInfos: ComandaInfo[] = [];

  for (const part of data.participants) {
    if (part.type === "existing") {
      const res = await ctx.db.execute<{ status: string; customer_id: string | null }>(
        sql`SELECT status, customer_id FROM comandas
            WHERE id = ${part.comandaId} AND tenant_id = ${ctx.tenantId} LIMIT 1`
      );
      const comanda = rows<{ status: string; customer_id: string | null }>(res)[0];
      if (!comanda) return { success: false, reason: "comanda_not_found", invalidComandaId: part.comandaId };
      if (comanda.status !== "open") return { success: false, reason: "comanda_closed", invalidComandaId: part.comandaId };
      comandaInfos.push({ id: part.comandaId, customerId: comanda.customer_id });
    } else {
      // Abre uma nova comanda para o cliente (ou balcão)
      const openRes = await openComanda(ctx, { customerId: part.customerId ?? null });
      if (!openRes.success) {
        if (openRes.reason === "customer_not_found") {
          return { success: false, reason: "customer_not_found" };
        }
        // Se já tem comanda aberta, reusa essa comanda aberta!
        if (openRes.reason === "already_has_open_comanda" && openRes.existingComandaId) {
          comandaInfos.push({ id: openRes.existingComandaId, customerId: part.customerId ?? null });
          continue;
        }
        return { success: false, reason: "comanda_not_found" };
      }
      comandaInfos.push({ id: openRes.comanda.id, customerId: openRes.comanda.customerId });
    }
  }

  // Insere a marcação na grade (comanda_id = NULL → indica rateio via splits).
  let bookingId: string;
  try {
    const bookingResult = await ctx.db.execute<{ id: string }>(
      sql`INSERT INTO court_bookings
            (tenant_id, court_id, court_time_slot_id, booking_date, start_time_hhmm,
             end_time_hhmm, price_cents_at_booking, status, comanda_id, customer_id, is_monthly, created_by_user_id)
          VALUES (${ctx.tenantId}, ${data.courtId}, ${slot.slotId}, ${data.date}, ${data.startTimeHHMM},
                  ${slot.endTimeHHMM}, ${effectivePriceCents}, 'booked', NULL, NULL, ${data.isMonthly}, ${ctx.actorUserId})
          RETURNING id`
    );
    bookingId = rows<{ id: string }>(bookingResult)[0].id;
  } catch (err) {
    if (isUniqueViolation(err)) return { success: false, reason: "double_booked" };
    throw err;
  }

  // Divide o valor igualmente entre os N participantes.
  const n = comandaInfos.length;
  const baseShare = Math.floor(effectivePriceCents / n);
  const remainder = effectivePriceCents - baseShare * n;

  const splitIds: string[] = [];
  for (let i = 0; i < comandaInfos.length; i++) {
    const comanda = comandaInfos[i];
    const shareCents = i === 0 ? baseShare + remainder : baseShare;

    const splitResult = await ctx.db.execute<{ id: string }>(
      sql`INSERT INTO court_booking_splits
            (tenant_id, court_booking_id, comanda_id, customer_id, share_cents)
          VALUES (${ctx.tenantId}, ${bookingId}, ${comanda.id}, ${comanda.customerId}, ${shareCents})
          RETURNING id`
    );
    splitIds.push(rows<{ id: string }>(splitResult)[0].id);

    // Insere a linha de comanda
    await insertRentalLine(ctx, {
      comandaId: comanda.id,
      bookingId,
      courtName: court.name,
      startTimeHHMM: data.startTimeHHMM,
      endTimeHHMM: slot.endTimeHHMM,
      priceInCents: shareCents,
    });
  }

  await writeAudit(ctx, "pdv.court_booking.split", {
    bookingId,
    splitIds,
    courtId: data.courtId,
    date: data.date,
    startTimeHHMM: data.startTimeHHMM,
    totalCents: effectivePriceCents,
    participantCount: n,
    isMonthly: data.isMonthly,
  });

  if (data.isMonthly) {
    await reserveRecurringMonthlyDates(ctx, {
      courtId: data.courtId,
      startDate: data.date,
      startTimeHHMM: data.startTimeHHMM,
      customerId: null,
    });
  }

  return { success: true, bookingId, splitIds };
}

