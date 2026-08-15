"use server";

import { requireModule } from "@/lib/session";
import { addClassPackageItemToComanda, AddClassPackageItemInputSchema, type AddClassPackageItemResult } from "@gestao-de-quadras/core/pdv";

export async function addClassPackageItemAction(
  comandaId: string,
  classPackageId: string,
  quantity: number
): Promise<AddClassPackageItemResult> {
  // Valida na fronteira pública da server action antes de chamar o serviço
  const data = AddClassPackageItemInputSchema.parse({ comandaId, classPackageId, quantity });
  const { ctx } = await requireModule("pdv");
  return addClassPackageItemToComanda(ctx, data);
}
