"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/session";
import { closeCashSession } from "@gestao-de-quadras/core/pdv";

export interface CloseCashSessionActionResult {
  success: boolean;
  error?: string;
  totalDifferenceCents?: number;
}

export async function closeCashSessionAction(input: {
  cashSessionId: string;
  counts: Array<{
    paymentMethod: "dinheiro" | "pix" | "cartao_credito" | "cartao_debito" | "pontos";
    countedCents: number;
  }>;
  closingNotes?: string;
}): Promise<CloseCashSessionActionResult> {
  const { ctx } = await requireModule("pdv");

  const result = await closeCashSession(ctx, {
    cashSessionId: input.cashSessionId,
    counts: input.counts,
    closingNotes: input.closingNotes,
  });

  if (!result.success) {
    if (result.reason === "session_closed") {
      return { success: false, error: "A sessão de caixa já está fechada." };
    }
    return { success: false, error: "Sessão de caixa não encontrada." };
  }

  revalidatePath("/pdv");
  revalidatePath("/pdv/caixa");
  return { success: true, totalDifferenceCents: result.totalDifferenceCents };
}
