"use server";

import { requireModule } from "@/lib/session";
import { linkCustomerToComanda, type LinkCustomerToComandaResult } from "@gestao-de-quadras/core/pdv";

export async function linkCustomerAction(
  comandaId: string,
  customerId: string
): Promise<LinkCustomerToComandaResult> {
  const { ctx } = await requireModule("pdv");
  return linkCustomerToComanda(ctx, { comandaId, customerId });
}
