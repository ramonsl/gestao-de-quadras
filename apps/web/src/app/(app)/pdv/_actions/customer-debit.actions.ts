"use server";

import { requireModule } from "@/lib/session";
import {
  getCustomerDebitSummary,
  transferComandaToCustomerDebit,
  settleCustomerDebit,
  type CustomerDebitSummary,
  type TransferToDebitResult,
  type SettleDebitResult,
} from "@gestao-de-quadras/core/pdv";

export async function getCustomerDebitSummaryAction(
  customerId: string
): Promise<CustomerDebitSummary> {
  const { ctx } = await requireModule("pdv");
  return getCustomerDebitSummary(ctx, customerId);
}

export async function transferComandaToCustomerDebitAction(
  comandaId: string,
  customerId: string
): Promise<TransferToDebitResult> {
  const { ctx } = await requireModule("pdv");
  return transferComandaToCustomerDebit(ctx, { comandaId, customerId });
}

export async function settleCustomerDebitAction(
  customerId: string,
  payments: Array<{
    paymentMethod: "dinheiro" | "pix" | "cartao_credito" | "cartao_debito" | "pontos";
    amountCents: number;
  }>
): Promise<SettleDebitResult> {
  const { ctx } = await requireModule("pdv");
  return settleCustomerDebit(ctx, { customerId, payments });
}
