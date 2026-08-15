"use server";

import { z } from "zod";
import { requireModule } from "@/lib/session";
import { getNotificationQueue } from "@/lib/queues";
import { debitOneClass, checkCustomerOptIn } from "@gestao-de-quadras/core/classes/class-balance.service";

export type DebitClassActionResult =
  | { success: true; remainingClasses: number }
  | { success: false; message: string };

export async function debitClassAction(studentClassBalanceId: string): Promise<DebitClassActionResult> {
  // Valida na fronteira pública antes de chamar o serviço
  z.string().uuid("ID de saldo inválido.").parse(studentClassBalanceId);
  const { ctx } = await requireModule("pdv");

  const result = await debitOneClass(ctx, { studentClassBalanceId });

  if (!result.success) {
    return {
      success: false,
      message:
        result.reason === "balance_exhausted"
          ? "Saldo de aulas esgotado para este pacote."
          : "Saldo não encontrado.",
    };
  }

  // Enfileira notificação WhatsApp se o cliente tiver opt-in ativo (LGPD)
  if (result.customerWhatsapp) {
    try {
      const hasOptIn = await checkCustomerOptIn(ctx, result.globalCustomerId);
      if (hasOptIn) {
        const remaining = result.remainingClasses;
        const bodyText =
          `Você utilizou 1 aula do pacote *${result.packageName}*. ` +
          `Saldo restante: ${remaining} aula${remaining !== 1 ? "s" : ""}.`;

        await getNotificationQueue().enqueueTextMessage({
          tenantId: ctx.tenantId,
          globalCustomerId: result.globalCustomerId,
          toE164: result.customerWhatsapp,
          bodyText,
        });
      }
    } catch (err) {
      // Erro na notificação não reverte o débito
      console.error("[pdv] debitClassAction: falha ao enfileirar notificação", err);
    }
  }

  return { success: true, remainingClasses: result.remainingClasses };
}
