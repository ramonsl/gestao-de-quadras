"use server";

import { requireModule } from "@/lib/session";
import { getCustomerPointsSummary, type CustomerPointsSummary } from "@gestao-de-quadras/core/points";

export async function getCustomerPointsSummaryAction(
  customerId: string,
  comandaTotalCents?: number
): Promise<CustomerPointsSummary | null> {
  try {
    const { ctx } = await requireModule("pdv");
    return await getCustomerPointsSummary(ctx, customerId, comandaTotalCents);
  } catch {
    return null;
  }
}
