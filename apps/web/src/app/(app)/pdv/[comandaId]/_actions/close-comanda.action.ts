"use server";

import { requireModule } from "@/lib/session";
import {
  type PaymentMethodEnum,
} from "@gestao-de-quadras/core/pdv";
import {
  closeComandaWithMembership,
  getSettlementPreview,
  type CloseComandaWithMembershipResult,
} from "@gestao-de-quadras/core/membership";
import { transactionalDb } from "@gestao-de-quadras/db";
import type { z } from "zod";

export interface ClosePaymentInput {
  paymentMethod: z.infer<typeof PaymentMethodEnum>;
  amountCents: number;
  receivedCents?: number;
}

export async function closeComandaAction(
  comandaId: string,
  payments: ClosePaymentInput[],
  settlementToken: string
): Promise<CloseComandaWithMembershipResult> {
  const { ctx } = await requireModule("pdv");
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await transactionalDb.transaction(
        async (tx) => closeComandaWithMembership(
          { ...ctx, db: tx as unknown as typeof ctx.db },
          { comandaId, settlementToken, payments }
        ),
        { isolationLevel: "serializable" }
      );
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
      if (attempt === 3 || !["40001", "40P01"].includes(code)) throw error;
    }
  }
  throw new Error("Falha inesperada ao fechar a comanda.");
}

export async function getSettlementPreviewAction(comandaId: string) {
  const { ctx } = await requireModule("pdv");
  return getSettlementPreview(ctx, comandaId);
}
