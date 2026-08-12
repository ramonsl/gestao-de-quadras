import { describe, it, expect, vi } from "vitest";
import {
  getTimeSlots,
  createCourtTimeSlot,
  generateSlotsFromRule,
  deleteTimeSlotsByDay,
  upsertCourtScheduleRule,
} from "./court-time-slot.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_TENANT = "11111111-1111-1111-1111-111111111111";

/** Constrói um context com chamadas db simuladas (queue FIFO de rowSets). */
const ctx = (rowSets: unknown[][]) => {
  let i = 0;
  return {
    db: { execute: vi.fn(async () => ({ rows: rowSets[i++] ?? [] })) },
    tenantId: VALID_TENANT,
    actorUserId: "user-1",
  } as any;
};

const slotRow = (over: Record<string, unknown> = {}) => ({
  id: "ts1",
  tenant_id: VALID_TENANT,
  court_id: "c1",
  day_of_week: 0,
  start_time_hhmm: "18:00",
  end_time_hhmm: "18:30",
  duration_minutes: 30,
  price_in_cents: 3500,
  created_at: new Date(),
  updated_at: new Date(),
  ...over,
});

// ---------------------------------------------------------------------------
// generateSlotsFromRule — função pura (sem I/O)
// ---------------------------------------------------------------------------

describe("generateSlotsFromRule", () => {
  it("gera blocos corretos de 30 min para intervalo de 1 hora", () => {
    const slots = generateSlotsFromRule("08:00", "09:00", 3500);
    expect(slots).toHaveLength(2);
    expect(slots[0]).toEqual({
      startTimeHHMM: "08:00",
      endTimeHHMM: "08:30",
      durationMinutes: 30,
      priceInCents: 3500,
    });
    expect(slots[1]).toEqual({
      startTimeHHMM: "08:30",
      endTimeHHMM: "09:00",
      durationMinutes: 30,
      priceInCents: 3500,
    });
  });

  it("gera 28 slots para intervalo de 08:00 a 22:00 (14 horas)", () => {
    const slots = generateSlotsFromRule("08:00", "22:00", 3500);
    expect(slots).toHaveLength(28);
    expect(slots[0].startTimeHHMM).toBe("08:00");
    expect(slots[27].endTimeHHMM).toBe("22:00");
  });

  it("gera 1 slot para intervalo de exatos 30 minutos", () => {
    const slots = generateSlotsFromRule("20:00", "20:30", 5000);
    expect(slots).toHaveLength(1);
    expect(slots[0].startTimeHHMM).toBe("20:00");
    expect(slots[0].endTimeHHMM).toBe("20:30");
  });

  it("descarta sobra menor que 30 min (ex: 08:00 a 08:45 → só 1 slot)", () => {
    const slots = generateSlotsFromRule("08:00", "08:45", 3500);
    expect(slots).toHaveLength(1);
    expect(slots[0].endTimeHHMM).toBe("08:30");
  });

  it("lança erro quando abertura >= fechamento", () => {
    expect(() => generateSlotsFromRule("10:00", "08:00", 3500)).toThrow(
      /anterior ao de fechamento/i
    );
    expect(() => generateSlotsFromRule("10:00", "10:00", 3500)).toThrow(
      /anterior ao de fechamento/i
    );
  });

  it("lança erro quando intervalo é menor que 30 min", () => {
    expect(() => generateSlotsFromRule("08:00", "08:29", 3500)).toThrow(
      /pelo menos 30 minutos/i
    );
  });

  it("preserva o pricePerSlotInCents em cada slot", () => {
    const slots = generateSlotsFromRule("18:00", "20:00", 7000);
    expect(slots.every((s) => s.priceInCents === 7000)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getTimeSlots
// ---------------------------------------------------------------------------

describe("getTimeSlots", () => {
  it("rejeita tenant_id inválido", async () => {
    await expect(
      getTimeSlots({ db: {}, tenantId: "x" } as any, "c1")
    ).rejects.toThrow(/tenant_id inválido/i);
  });

  it("lista faixas mapeando snake → camel", async () => {
    const result = await getTimeSlots(ctx([[slotRow()]]), "c1");
    expect(result[0].startTimeHHMM).toBe("18:00");
    expect(result[0].durationMinutes).toBe(30);
    expect(result[0].priceInCents).toBe(3500);
  });
});

// ---------------------------------------------------------------------------
// createCourtTimeSlot
// ---------------------------------------------------------------------------

describe("createCourtTimeSlot", () => {
  it("cria faixa horária (após validar que o court é do tenant)", async () => {
    // 1ª query: checagem anti-IDOR → 2ª: INSERT
    const result = await createCourtTimeSlot(
      ctx([[{ id: "c1" }], [slotRow()]]),
      {
        courtId: "c1",
        dayOfWeek: 0,
        startTimeHHMM: "18:00",
        endTimeHHMM: "18:30",
        durationMinutes: 30,
        priceInCents: 3500,
      }
    );
    expect(result.id).toBe("ts1");
    expect(result.dayOfWeek).toBe(0);
  });

  it("rejeita court de outro tenant (anti-IDOR)", async () => {
    await expect(
      createCourtTimeSlot(ctx([[]]), {
        courtId: "court-de-outro-tenant",
        dayOfWeek: 0,
        startTimeHHMM: "18:00",
        endTimeHHMM: "18:30",
        durationMinutes: 30,
        priceInCents: 3500,
      })
    ).rejects.toThrow(/não encontrada nesta arena/i);
  });
});

// ---------------------------------------------------------------------------
// deleteTimeSlotsByDay
// ---------------------------------------------------------------------------

describe("deleteTimeSlotsByDay", () => {
  it("não executa query se days estiver vazio", async () => {
    const c = ctx([]);
    await deleteTimeSlotsByDay(c, "c1", []);
    expect(c.db.execute).not.toHaveBeenCalled();
  });

  it("deleta slots dos dias informados (após validar court)", async () => {
    const c = ctx([[{ id: "c1" }], []]);
    await deleteTimeSlotsByDay(c, "c1", [1, 2, 3]);
    // 1ª chamada: assertCourtInTenant, 2ª: DELETE
    expect(c.db.execute).toHaveBeenCalledTimes(2);
  });

  it("rejeita court de outro tenant (anti-IDOR)", async () => {
    await expect(
      deleteTimeSlotsByDay(ctx([[]]), "court-estranho", [1])
    ).rejects.toThrow(/não encontrada nesta arena/i);
  });
});

// ---------------------------------------------------------------------------
// upsertCourtScheduleRule
// ---------------------------------------------------------------------------

describe("upsertCourtScheduleRule", () => {
  it("lança erro se days está vazio", async () => {
    await expect(
      upsertCourtScheduleRule(ctx([]), {
        courtId: "c1",
        days: [],
        openingHHMM: "08:00",
        closingHHMM: "22:00",
        pricePerSlotInCents: 3500,
      })
    ).rejects.toThrow(/pelo menos um dia/i);
  });

  it("cria 2 slots para 1 dia com intervalo de 1 hora", async () => {
    // rowSets: [court check para delete] + [court check ign (mesmo court)] + [INSERT × 2]
    // Na prática deleteTimeSlotsByDay chama assertCourtInTenant (1 row) + DELETE
    // Depois upsertCourtScheduleRule já não chama assertCourtInTenant de novo — delega ao delete
    const c = ctx([
      [{ id: "c1" }], // assertCourtInTenant dentro de deleteTimeSlotsByDay
      [], // DELETE
      [], // INSERT slot 1
      [], // INSERT slot 2
    ]);

    const result = await upsertCourtScheduleRule(c, {
      courtId: "c1",
      days: [1],
      openingHHMM: "08:00",
      closingHHMM: "09:00",
      pricePerSlotInCents: 3500,
    });

    expect(result.slotsCreated).toBe(2);
    // Total de execuções: 1 (court check) + 1 (DELETE) + 2 (INSERTs) = 4
    expect(c.db.execute).toHaveBeenCalledTimes(4);
  });

  it("cria 56 slots para 2 dias com intervalo de 14 horas (08:00–22:00)", async () => {
    // 2 dias: [assertCourtInTenant + DELETE] + [28 × 2 INSERTs]
    const rowSets: unknown[][] = [
      [{ id: "c1" }], // court check
      [], // DELETE
      ...Array(56).fill([]), // 56 INSERTs
    ];
    const c = ctx(rowSets);

    const result = await upsertCourtScheduleRule(c, {
      courtId: "c1",
      days: [1, 2],
      openingHHMM: "08:00",
      closingHHMM: "22:00",
      pricePerSlotInCents: 3500,
    });

    expect(result.slotsCreated).toBe(56);
  });

  it("propaga erro se abertura >= fechamento", async () => {
    await expect(
      upsertCourtScheduleRule(ctx([]), {
        courtId: "c1",
        days: [1],
        openingHHMM: "22:00",
        closingHHMM: "08:00",
        pricePerSlotInCents: 3500,
      })
    ).rejects.toThrow(/anterior ao de fechamento/i);
  });
});
