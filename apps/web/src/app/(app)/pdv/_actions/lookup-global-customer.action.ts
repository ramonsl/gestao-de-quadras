"use server";

import { requireModule } from "@/lib/session";
import { findOrCreateGlobalCustomer, WhatsappSchema } from "@gestao-de-quadras/core/customers/customer.service";

export interface GlobalCustomerPreview {
  found: boolean;
  name?: string;
  email?: string | null;
  birthDate?: string | null;
}

/**
 * Só leitura — prévia dos dados globais (CAD-01) para o operador confirmar
 * antes de criar o vínculo local no cadastro rápido (PDV-02, roteiro de QA).
 */
export async function lookupGlobalCustomerAction(whatsapp: string): Promise<GlobalCustomerPreview> {
  const { ctx } = await requireModule("pdv");
  const parsed = WhatsappSchema.safeParse(whatsapp);
  if (!parsed.success) return { found: false };

  const result = await findOrCreateGlobalCustomer(ctx.db, parsed.data);
  if (!result.found) return { found: false };
  return {
    found: true,
    name: result.customer.name,
    email: result.customer.email,
    birthDate: result.customer.birthDate,
  };
}
