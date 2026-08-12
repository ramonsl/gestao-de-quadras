"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/session";
import { reopenComanda, type ReopenComandaResult } from "@gestao-de-quadras/core/pdv";

export async function reopenComandaAction(
  comandaId: string,
  reason: string,
  supervisorPassword?: string
): Promise<ReopenComandaResult> {
  const { ctx } = await requireModule("pdv");

  const result = await reopenComanda(ctx, {
    comandaId,
    reason,
    supervisorPassword,
  });

  if (result.success) {
    revalidatePath(`/pdv/${comandaId}`);
    revalidatePath("/pdv");
  }

  return result;
}
