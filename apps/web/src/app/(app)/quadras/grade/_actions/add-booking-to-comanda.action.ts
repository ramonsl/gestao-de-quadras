"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/session";
import { addCourtBookingToExistingComanda } from "@gestao-de-quadras/core/courts/court-booking.service";

export interface AddBookingActionResult {
  success: boolean;
  error?: string;
}

const REASON_MESSAGES: Record<string, string> = {
  court_not_found: "Quadra não encontrada nesta arena.",
  slot_not_found: "Não há faixa horária configurada para este horário.",
  past_date: "Não é possível marcar locações em datas passadas.",
  double_booked: "Este horário acabou de ser ocupado. Atualize a grade.",
  comanda_not_found: "Comanda não encontrada nesta arena.",
  comanda_closed: "Esta comanda já foi fechada.",
};

export async function addBookingToComandaAction(input: {
  courtId: string;
  date: string;
  startTimeHHMM: string;
  comandaId: string;
  isMonthly?: boolean;
}): Promise<AddBookingActionResult> {
  const { ctx } = await requireModule("quadras");

  const result = await addCourtBookingToExistingComanda(ctx, {
    courtId: input.courtId,
    date: input.date,
    startTimeHHMM: input.startTimeHHMM,
    comandaId: input.comandaId,
    isMonthly: input.isMonthly ?? false,
  });

  if (!result.success) {
    return { success: false, error: REASON_MESSAGES[result.reason] ?? "Não foi possível adicionar a locação." };
  }

  revalidatePath("/quadras/grade");
  return { success: true };
}
