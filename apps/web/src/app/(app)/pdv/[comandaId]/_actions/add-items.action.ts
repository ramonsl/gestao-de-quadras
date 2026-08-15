"use server";

import { requireModule } from "@/lib/session";
import { addItemToComanda } from "@gestao-de-quadras/core/pdv";
import { getNotificationQueue } from "@/lib/queues";

export interface BatchItemInput {
  productId: string;
  quantity: number;
}

export type AddItemsActionResult =
  | { success: true; comandaTotalCents: number }
  | { success: false; message: string };

export async function addItemsAction(
  comandaId: string,
  items: BatchItemInput[]
): Promise<AddItemsActionResult> {
  if (!items || items.length === 0) {
    return { success: true, comandaTotalCents: 0 };
  }

  const { ctx } = await requireModule("pdv");

  let lastTotalCents = 0;
  for (const item of items) {
    const res = await addItemToComanda(
      ctx,
      { comandaId, productId: item.productId, quantity: item.quantity },
      getNotificationQueue()
    );
    if (!res.success) {
      return {
        success: false,
        message:
          res.reason === "product_not_found"
            ? "Um dos produtos não foi encontrado."
            : "Não foi possível lançar os itens — a comanda pode estar fechada.",
      };
    }
    lastTotalCents = res.comandaTotalCents;
  }

  return { success: true, comandaTotalCents: lastTotalCents };
}
