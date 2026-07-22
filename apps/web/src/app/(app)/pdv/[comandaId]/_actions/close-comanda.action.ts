"use server";

import { requireModule } from "@/lib/session";
import {
  closeComanda,
  type PaymentMethodEnum,
  type CloseComandaResult,
} from "@gestao-de-quadras/core/pdv";
import type { z } from "zod";

export interface ClosePaymentInput {
  paymentMethod: z.infer<typeof PaymentMethodEnum>;
  amountCents: number;
  receivedCents?: number;
}

export async function closeComandaAction(
  comandaId: string,
  payments: ClosePaymentInput[],
  discountCents: number = 0
): Promise<CloseComandaResult> {
  const { ctx } = await requireModule("pdv");
  return closeComanda(ctx, { comandaId, discountCents, payments });
}
