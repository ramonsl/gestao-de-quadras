"use server";

import { requireModule } from "@/lib/session";
import { listOpenComandas, type OpenComandaListItem } from "@gestao-de-quadras/core/pdv";

/**
 * Lista as comandas abertas do tenant, excluindo a comanda de origem
 * (para popular o seletor de destino na transferência de itens — PDV-10).
 */
export async function listOpenComandasAction(
  excludeComandaId: string
): Promise<OpenComandaListItem[]> {
  const { ctx } = await requireModule("pdv");
  const all = await listOpenComandas(ctx);
  return all.filter((c) => c.id !== excludeComandaId);
}
