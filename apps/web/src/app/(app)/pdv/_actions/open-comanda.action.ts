"use server";

import { requireModule } from "@/lib/session";
import { openComanda } from "@gestao-de-quadras/core/pdv";

export type OpenComandaActionResult =
  | { success: true; comandaId: string }
  | { success: false; message: string };

export async function openComandaAction(customerId: string | null): Promise<OpenComandaActionResult> {
  const { ctx } = await requireModule("pdv");
  const result = await openComanda(ctx, { customerId });
  if (!result.success) {
    return { success: false, message: "Cliente não encontrado nesta arena." };
  }
  return { success: true, comandaId: result.comanda.id };
}
