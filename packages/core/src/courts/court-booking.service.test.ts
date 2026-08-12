import { describe, it, expect } from "vitest";
import { SplitCourtBookingInputSchema } from "./court-booking.service";

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
