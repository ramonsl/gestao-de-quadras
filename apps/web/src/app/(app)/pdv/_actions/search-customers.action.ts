"use server";

import { requireModule } from "@/lib/session";
import { searchCustomersForPdv } from "@gestao-de-quadras/core/customers/customer.service";

export interface CustomerSearchResult {
  id: string;
  name: string;
  whatsapp: string;
}

export async function searchCustomersAction(query: string): Promise<CustomerSearchResult[]> {
  const { ctx } = await requireModule("pdv");
  const results = await searchCustomersForPdv(ctx, query);
  return results.map((c) => ({ id: c.id, name: c.name, whatsapp: c.whatsapp }));
}
