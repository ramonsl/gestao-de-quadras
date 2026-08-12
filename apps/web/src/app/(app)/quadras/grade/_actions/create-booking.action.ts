"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/session";
import { createCourtBookingWithNewComanda } from "@gestao-de-quadras/core/courts/court-booking.service";

export interface CreateBookingActionResult {
  success: boolean;
  error?: string;
  comandaId?: string;
}

const REASON_MESSAGES: Record<string, string> = {
  court_not_found: "Quadra não encontrada nesta arena.",
  slot_not_found: "Não há faixa horária configurada para este horário.",
  past_date: "Não é possível marcar locações em datas passadas.",
  double_booked: "Este horário acabou de ser ocupado. Atualize a grade.",
  customer_not_found: "Cliente não encontrado nesta arena.",
  already_has_open_comanda:
    "Este cliente já tem uma comanda aberta. Use \"Adicionar a comanda existente\".",
};

export async function createBookingAction(input: {
  courtId: string;
  date: string;
  startTimeHHMM: string;
  customerId?: string | null;
  isMonthly?: boolean;
}): Promise<CreateBookingActionResult> {
  const { ctx } = await requireModule("quadras");

  const result = await createCourtBookingWithNewComanda(ctx, {
    courtId: input.courtId,
    date: input.date,
    startTimeHHMM: input.startTimeHHMM,
    customerId: input.customerId ?? null,
    isMonthly: input.isMonthly ?? false,
  });

  if (!result.success) {
    return { success: false, error: REASON_MESSAGES[result.reason] ?? "Não foi possível criar a locação." };
  }

  revalidatePath("/quadras/grade");
  return { success: true, comandaId: result.comandaId };
}
