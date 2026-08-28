"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/session";
import type { ReopenComandaResult } from "@gestao-de-quadras/core/pdv";
import { reopenComandaWithSettlement } from "@gestao-de-quadras/core/membership";
import { transactionalDb } from "@gestao-de-quadras/db";

export async function reopenComandaAction(
  comandaId: string,
  reason: string,
  supervisorPassword?: string
): Promise<ReopenComandaResult | { success: false; reason: "settlement_reversal_blocked" }> {
  const { ctx } = await requireModule("pdv");

  const result = await transactionalDb.transaction(
    async (tx) => reopenComandaWithSettlement(
      { ...ctx, db: tx as unknown as typeof ctx.db },
      { comandaId, reason, supervisorPassword }
    ),
    { isolationLevel: "serializable" }
  );

  if (result.success) {
    revalidatePath(`/pdv/${comandaId}`);
    revalidatePath("/pdv");
  }

  return result;
}
