"use server";

import { requireModule } from "@/lib/session";
import {
  openCashSession,
  addCashMovement,
  closeCashSession,
  getCurrentOpenCashSession,
  getCashSessionSummary,
  type OpenCashSessionResult,
  type AddCashMovementResult,
  type CloseCashSessionResult,
  type CashSessionSummary,
} from "@gestao-de-quadras/core/pdv";

export async function getCurrentCashSessionAction() {
  const { ctx } = await requireModule("pdv");
  return getCurrentOpenCashSession(ctx);
}

export async function openCashSessionAction(
  initialCashCents: number
): Promise<OpenCashSessionResult> {
  const { ctx } = await requireModule("pdv");
  return openCashSession(ctx, { initialCashCents });
}

export async function addCashMovementAction(
  cashSessionId: string,
  type: "sangria" | "suprimento",
  amountCents: number,
  reason: string
): Promise<AddCashMovementResult> {
  const { ctx } = await requireModule("pdv");
  return addCashMovement(ctx, { cashSessionId, type, amountCents, reason });
}

export async function getCashSessionSummaryAction(
  cashSessionId: string
): Promise<CashSessionSummary | null> {
  const { ctx } = await requireModule("pdv");
  return getCashSessionSummary(ctx, cashSessionId);
}

export async function closeCashSessionAction(
  cashSessionId: string,
  counts: Array<{
    paymentMethod: "dinheiro" | "pix" | "cartao_credito" | "cartao_debito" | "pontos";
    countedCents: number;
  }>,
  closingNotes?: string
): Promise<CloseCashSessionResult> {
  const { ctx } = await requireModule("pdv");
  return closeCashSession(ctx, { cashSessionId, counts, closingNotes });
}
