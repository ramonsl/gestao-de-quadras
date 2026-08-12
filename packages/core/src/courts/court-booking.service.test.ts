import { describe, it, expect, vi } from "vitest";
import {
  SplitCourtBookingInputSchema,
  getRemainingWeekdayDatesInMonth,
  getCourtGridForDate,
  createCourtBookingWithNewComanda,
} from "./court-booking.service";
import type { TenantContext } from "../db/tenant";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const ACTOR_ID = "22222222-2222-2222-2222-222222222222";
const COURT_ID = "33333333-3333-3333-3333-333333333333";

/** Texto SQL de um objeto `sql` da drizzle (junta os StringChunks), em minúsculas. */
function sqlText(sqlObj: unknown): string {
  const chunks =
    (sqlObj as { queryChunks?: Array<{ value?: string[] }> } | undefined)?.queryChunks ?? [];
  return chunks
    .map((c) => (Array.isArray(c?.value) ? c.value.join("") : ""))
    .join(" ")
    .toLowerCase();
}

type Handler = { match: RegExp; rows?: unknown[]; throw?: unknown };

/** Mock que despacha por conteúdo do SQL (robusto ao Promise.all) e registra os textos executados. */
function mkMatchCtx(handlers: Handler[]): { ctx: TenantContext; executed: string[] } {
  const executed: string[] = [];
  const ctx = {
    tenantId: TENANT_ID,
    actorUserId: ACTOR_ID,
    db: {
      execute: vi.fn().mockImplementation(async (q: unknown) => {
        const text = sqlText(q);
        executed.push(text);
        const handler = handlers.find((h) => h.match.test(text));
        if (!handler) throw new Error(`mkMatchCtx: sem handler para SQL: ${text}`);
        if (handler.throw) throw handler.throw;
        return { rows: handler.rows ?? [] };
      }),
    },
  } as unknown as TenantContext & { db: { execute: ReturnType<typeof vi.fn> } };
  return { ctx, executed };
}

describe("getRemainingWeekdayDatesInMonth", () => {
  it("calcula corretamente as terças-feiras restantes de Agosto/2026", () => {
    // 11/08/2026 é uma Terça-feira
    const dates = getRemainingWeekdayDatesInMonth("2026-08-11");
    expect(dates).toEqual([
      "2026-08-11",
      "2026-08-18",
      "2026-08-25",
    ]);
  });

  it("calcula corretamente as segundas-feiras quando iniciado no início do mês", () => {
    // 03/08/2026 é uma Segunda-feira (Agosto/2026 tem 5 segundas-feiras: 03, 10, 17, 24, 31)
    const dates = getRemainingWeekdayDatesInMonth("2026-08-03");
    expect(dates).toEqual([
      "2026-08-03",
      "2026-08-10",
      "2026-08-17",
      "2026-08-24",
      "2026-08-31",
    ]);
  });
});

describe("SplitCourtBookingInputSchema", () => {
  it("valida entrada correta com 2 ou mais participantes (existentes e/ou novos)", () => {
    const valid = SplitCourtBookingInputSchema.safeParse({
      courtId: "123e4567-e89b-12d3-a456-426614174000",
      date: "2026-08-15",
      startTimeHHMM: "08:00",
      participants: [
        { type: "existing", comandaId: "123e4567-e89b-12d3-a456-426614174001" },
        { type: "new", customerId: "123e4567-e89b-12d3-a456-426614174002" },
      ],
    });
    expect(valid.success).toBe(true);
  });

  it("rejeita quando houver menos de 2 participantes para rateio", () => {
    const invalid = SplitCourtBookingInputSchema.safeParse({
      courtId: "123e4567-e89b-12d3-a456-426614174000",
      date: "2026-08-15",
      startTimeHHMM: "08:00",
      participants: [{ type: "existing", comandaId: "123e4567-e89b-12d3-a456-426614174001" }],
    });
    expect(invalid.success).toBe(false);
  });

  it("rejeita formato de data ou hora inválido", () => {
    const invalid = SplitCourtBookingInputSchema.safeParse({
      courtId: "123e4567-e89b-12d3-a456-426614174000",
      date: "15-08-2026",
      startTimeHHMM: "8:00",
      participants: [
        { type: "existing", comandaId: "123e4567-e89b-12d3-a456-426614174001" },
        { type: "new", customerId: null },
      ],
    });
    expect(invalid.success).toBe(false);
  });
});

describe("getCourtGridForDate (AC1/AC2)", () => {
  it("mapeia status Livre / Ocupado / Reservado e isola por tenant", async () => {
    const { ctx, executed } = mkMatchCtx([
      { match: /from court_booking_splits/, rows: [] },
      {
        match: /from court_bookings cb/,
        rows: [
          {
            id: "b-09",
            court_id: COURT_ID,
            start_time_hhmm: "09:00",
            end_time_hhmm: "09:30",
            price_cents_at_booking: 14000,
            status: "booked",
            comanda_id: "cmd-1",
            is_monthly: false,
            customer_name: "João",
          },
          {
            id: "b-10",
            court_id: COURT_ID,
            start_time_hhmm: "10:00",
            end_time_hhmm: "10:30",
            price_cents_at_booking: 14000,
            status: "reserved",
            comanda_id: null,
            is_monthly: false,
            customer_name: null,
          },
        ],
      },
      { match: /from courts\b/, rows: [{ id: COURT_ID, name: "Quadra 01" }] },
      {
        match: /from court_time_slots/,
        rows: [
          { court_id: COURT_ID, start_time_hhmm: "08:00", end_time_hhmm: "08:30", price_in_cents: 14000 },
          { court_id: COURT_ID, start_time_hhmm: "09:00", end_time_hhmm: "09:30", price_in_cents: 14000 },
          { court_id: COURT_ID, start_time_hhmm: "10:00", end_time_hhmm: "10:30", price_in_cents: 14000 },
        ],
      },
    ]);

    const grid = await getCourtGridForDate(ctx, { date: "2026-08-11" });

    const byStart = new Map(grid.cells.map((c) => [c.startTimeHHMM, c]));
    expect(byStart.get("08:00")?.status).toBe("free");
    expect(byStart.get("09:00")?.status).toBe("booked");
    expect(byStart.get("09:00")?.customerName).toBe("João");
    expect(byStart.get("10:00")?.status).toBe("reserved");
    expect(grid.rowStartTimes).toEqual(["08:00", "09:00", "10:00"]);

    // Isolamento (regra 1): toda query filtra tenant_id.
    expect(executed.length).toBeGreaterThan(0);
    expect(executed.every((t) => t.includes("tenant_id"))).toBe(true);
  });
});

describe("createCourtBookingWithNewComanda (AC3/AC4)", () => {
  const NOW = new Date("2026-08-11T12:00:00Z");
  const baseInput = { courtId: COURT_ID, date: "2026-08-20", startTimeHHMM: "08:00", customerId: null };

  it("retorna court_not_found quando a quadra não é do tenant (IDOR)", async () => {
    const { ctx } = mkMatchCtx([{ match: /from courts\b/, rows: [] }]);
    const res = await createCourtBookingWithNewComanda(ctx, baseInput, NOW);
    expect(res).toEqual({ success: false, reason: "court_not_found" });
  });

  it("bloqueia data no passado", async () => {
    const { ctx } = mkMatchCtx([
      { match: /from courts\b/, rows: [{ id: COURT_ID, tenant_id: TENANT_ID, name: "Quadra 01", modality: "padel", is_active: true, created_at: NOW, updated_at: NOW }] },
    ]);
    const res = await createCourtBookingWithNewComanda(ctx, { ...baseInput, date: "2026-08-01" }, NOW);
    expect(res).toEqual({ success: false, reason: "past_date" });
  });

  it("mapeia a violação do índice único (23505) para double_booked (guarda rígida — AC4)", async () => {
    const { ctx } = mkMatchCtx([
      { match: /from courts\b/, rows: [{ id: COURT_ID, tenant_id: TENANT_ID, name: "Quadra 01", modality: "padel", is_active: true, created_at: NOW, updated_at: NOW }] },
      { match: /from court_time_slots/, rows: [{ id: "slot-1", end_time_hhmm: "08:30", price_in_cents: 14000 }] },
      { match: /insert into court_bookings/, throw: { code: "23505" } },
    ]);
    const res = await createCourtBookingWithNewComanda(ctx, baseInput, NOW);
    expect(res).toEqual({ success: false, reason: "double_booked" });
  });
});
