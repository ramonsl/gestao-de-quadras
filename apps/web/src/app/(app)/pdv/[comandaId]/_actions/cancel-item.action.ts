"use server";

import { requireModule } from "@/lib/session";
import { cancelComandaItem, type CancelComandaItemResult } from "@gestao-de-quadras/core/pdv";

export async function cancelItemAction(
  comandaId: string,
  comandaItemId: string,
  reason: string,
  supervisorPassword?: string
): Promise<CancelComandaItemResult> {
  const { ctx } = await requireModule("pdv");
  return cancelComandaItem(ctx, {
    comandaId,
    comandaItemId,
    reason,
    supervisorPassword,
  });
}
