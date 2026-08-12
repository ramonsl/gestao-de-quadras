"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/session";
import { splitCourtBookingAcrossComandas } from "@gestao-de-quadras/core/courts/court-booking.service";

export interface SplitBookingActionResult {
  success: boolean;
  error?: string;
}

const REASON_MESSAGES: Record<string, string> = {
  court_not_found: "Quadra não encontrada nesta arena.",
  slot_not_found: "Não há faixa horária configurada para este horário.",
  past_date: "Não é possível marcar locações em datas passadas.",
  double_booked: "Este horário acabou de ser ocupado. Atualize a grade.",
  comanda_not_found: "Uma das comandas selecionadas não existe mais.",
  comanda_closed: "Uma das comandas selecionadas já está fechada.",
};

export async function splitBookingAction(input: {
  courtId: string;
  date: string;
  startTimeHHMM: string;
  comandaIds: string[];
}): Promise<SplitBookingActionResult> {
  const { ctx } = await requireModule("quadras");

  const result = await splitCourtBookingAcrossComandas(ctx, {
    courtId: input.courtId,
    date: input.date,
    startTimeHHMM: input.startTimeHHMM,
    comandaIds: input.comandaIds,
  });

  if (!result.success) {
    return {
      success: false,
      error: REASON_MESSAGES[result.reason] ?? "Não foi possível ratear a locação.",
    };
  }

  revalidatePath("/quadras/grade");
  return { success: true };
}
