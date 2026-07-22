"use server";

import { requireModule } from "@/lib/session";
import { addItemToComanda, type AddComandaItemResult } from "@gestao-de-quadras/core/pdv";

export async function addItemAction(
  comandaId: string,
  productId: string,
  quantity: number
): Promise<AddComandaItemResult> {
  const { ctx } = await requireModule("pdv");
  return addItemToComanda(ctx, { comandaId, productId, quantity });
}
