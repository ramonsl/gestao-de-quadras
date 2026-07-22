"use server";

import { requireModule } from "@/lib/session";
import { quickCreateCustomerForPdv } from "@gestao-de-quadras/core/customers/customer.service";

export type QuickCreateCustomerState =
  | { status: "idle" }
  | { status: "error"; message?: string; fieldErrors?: Record<string, string[] | undefined> }
  | { status: "success"; customerId: string; customerName: string; customerWhatsapp: string };

export async function quickCreateCustomerAction(
  _prev: QuickCreateCustomerState,
  formData: FormData
): Promise<QuickCreateCustomerState> {
  const { ctx } = await requireModule("pdv");

  const result = await quickCreateCustomerForPdv(ctx, {
    whatsapp: String(formData.get("whatsapp") ?? ""),
    name: String(formData.get("name") ?? ""),
    optInLgpd: formData.get("optInLgpd") === "on",
  });

  if (!result.success) {
    return { status: "error", message: "Verifique os campos.", fieldErrors: result.errors };
  }

  return {
    status: "success",
    customerId: result.customer.id,
    customerName: result.customer.name,
    customerWhatsapp: result.customer.whatsapp,
  };
}
