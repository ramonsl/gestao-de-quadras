import { describe, it, expect } from "vitest";
import { getTimeSlots, createCourtTimeSlot } from "./court-time-slot.service";

const ctx = (rowSets: unknown[][]) => {
  let i = 0;
  return {
    db: { execute: async () => ({ rows: rowSets[i++] ?? [] }) },
    tenantId: "11111111-1111-1111-1111-111111111111",
    actorUserId: "user-1",
  } as any;
};

const slotRow = (over: Record<string, unknown> = {}) => ({
  id: "ts1",
  court_id: "c1",
  day_of_week: 0,
  start_time_hhmm: "18:00",
  end_time_hhmm: "19:00",
  duration_minutes: 60,
  price_in_cents: 12000,
  created_at: new Date(),
  updated_at: new Date(),
  ...over,
});

describe("Court Time Slot Service", () => {
  it("rejeita tenant_id inválido", async () => {
    await expect(getTimeSlots({ db: {}, tenantId: "x" } as any, "c1")).rejects.toThrow(
      /tenant_id inválido/i
    );
  });

  it("lista faixas mapeando snake -> camel", async () => {
    const result = await getTimeSlots(ctx([[slotRow()]]), "c1");
    expect(result[0].startTimeHHMM).toBe("18:00");
    expect(result[0].durationMinutes).toBe(60);
    expect(result[0].priceInCents).toBe(12000);
  });

  it("cria faixa horária", async () => {
    const result = await createCourtTimeSlot(ctx([[slotRow()]]), {
      courtId: "c1",
      dayOfWeek: 0,
      startTimeHHMM: "18:00",
      endTimeHHMM: "19:00",
      durationMinutes: 60,
      priceInCents: 12000,
    });
    expect(result.id).toBe("ts1");
    expect(result.dayOfWeek).toBe(0);
  });
});
