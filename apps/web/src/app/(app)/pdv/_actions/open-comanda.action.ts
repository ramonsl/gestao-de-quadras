"use server";

import { requireModule } from "@/lib/session";
import { openComanda } from "@gestao-de-quadras/core/pdv";

export type OpenComandaActionResult =
  | { success: true; comandaId: string }
  | { success: false; reason: "already_has_open_comanda"; existingComandaId: string; message: string }
  | { success: false; reason?: string; message: string };

export async function openComandaAction(customerId: string | null): Promise<OpenComandaActionResult> {
  const { ctx } = await requireModule("pdv");
  const result = await openComanda(ctx, { customerId });
  if (!result.success) {
    if (result.reason === "already_has_open_comanda") {
      return {
        success: false,
        reason: "already_has_open_comanda",
        existingComandaId: result.existingComandaId,
        message: "Este cliente já possui uma comanda em aberto nesta arena.",
      };
    }
    return { success: false, message: "Cliente não encontrado nesta arena." };
  }
  return { success: true, comandaId: result.comanda.id };
}
