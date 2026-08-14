"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/session";
import { addCashMovement } from "@gestao-de-quadras/core/pdv";

export interface AddCashMovementActionResult {
  success: boolean;
  error?: string;
}

export async function addCashMovementAction(input: {
  cashSessionId: string;
  type: "sangria" | "suprimento";
  amountCents: number;
  reason: string;
}): Promise<AddCashMovementActionResult> {
  const { ctx } = await requireModule("pdv");

  const result = await addCashMovement(ctx, {
    cashSessionId: input.cashSessionId,
    type: input.type,
    amountCents: input.amountCents,
    reason: input.reason,
  });

  if (!result.success) {
    if (result.reason === "session_closed") {
      return { success: false, error: "A sessão de caixa já está fechada." };
    }
    return { success: false, error: "Sessão de caixa não encontrada." };
  }

  revalidatePath("/pdv");
  revalidatePath("/pdv/caixa");
  return { success: true };
}
