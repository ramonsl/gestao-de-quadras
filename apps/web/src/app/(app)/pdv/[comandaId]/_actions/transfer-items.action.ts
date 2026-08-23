"use server";

import { requireModule } from "@/lib/session";
import { transferItemsBetweenComandas, type TransferItemsResult } from "@gestao-de-quadras/core/pdv";

export async function transferItemsAction(
  sourceComandaId: string,
  destinationComandaId: string,
  itemIds: string[],
  justificativa?: string
): Promise<TransferItemsResult> {
  const { ctx } = await requireModule("pdv");
  return transferItemsBetweenComandas(ctx, {
    sourceComandaId,
    destinationComandaId,
    itemIds,
    justificativa,
  });
}
