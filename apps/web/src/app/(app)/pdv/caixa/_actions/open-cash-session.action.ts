"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/session";
import { openCashSession } from "@gestao-de-quadras/core/pdv";

export interface OpenCashSessionActionResult {
  success: boolean;
  error?: string;
}

export async function openCashSessionAction(input: {
  initialCashCents: number;
}): Promise<OpenCashSessionActionResult> {
  const { ctx } = await requireModule("pdv");

  const result = await openCashSession(ctx, {
    initialCashCents: input.initialCashCents,
  });

  if (!result.success) {
    if (result.reason === "already_open") {
      return { success: false, error: "Já existe uma sessão de caixa aberta para esta arena." };
    }
    return { success: false, error: "Não foi possível abrir o caixa." };
  }

  revalidatePath("/pdv");
  revalidatePath("/pdv/caixa");
  return { success: true };
}
