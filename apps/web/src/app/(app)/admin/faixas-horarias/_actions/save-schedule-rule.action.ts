"use server";

import { requireSession, arenaContext } from "@/lib/session";
import {
  upsertCourtScheduleRule,
  generateSlotsFromRule,
} from "@gestao-de-quadras/core/courts/court-time-slot.service";
import { z } from "zod";

const TIME_REGEX = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

const SaveScheduleRuleSchema = z
  .object({
    courtId: z.string().uuid("Quadra inválida"),
    days: z
      .array(z.coerce.number().int().min(0).max(6))
      .min(1, "Selecione pelo menos um dia da semana"),
    openingHHMM: z
      .string()
      .regex(TIME_REGEX, "Formato HH:MM inválido"),
    closingHHMM: z
      .string()
      .regex(TIME_REGEX, "Formato HH:MM inválido"),
    /** Preço em reais (ex: 35.00). Convertemos para centavos na action. */
    pricePerSlot: z.coerce
      .number()
      .positive("Preço deve ser maior que 0"),
  })
  .refine(
    (data) => {
      const toMin = (hhmm: string) => {
        const [h, m] = hhmm.split(":").map(Number);
        return h * 60 + m;
      };
      return toMin(data.openingHHMM) < toMin(data.closingHHMM);
    },
    { message: "Horário de abertura deve ser anterior ao de fechamento", path: ["closingHHMM"] }
  );

export type SaveScheduleRuleResult =
  | { success: true; slotsCreated: number }
  | { error: string; fieldErrors?: Record<string, string[]> };

/**
 * Salva (upsert) a regra de grade de horários de uma quadra.
 * Deleta os slots existentes dos dias informados e recria a grade completa
 * de slots de 30 minutos com base no horário de abertura/fechamento.
 */
export async function saveScheduleRuleAction(
  formData: FormData
): Promise<SaveScheduleRuleResult> {
  const session = await requireSession();
  if (!["admin", "gerente"].includes(session.role)) {
    return { error: "Acesso negado: apenas Admin ou Gerente podem configurar horários." };
  }

  // FormData pode ter múltiplos valores para "days[]" (checkboxes).
  const rawDays = formData.getAll("days").map(String);

  const parsed = SaveScheduleRuleSchema.safeParse({
    courtId: formData.get("courtId"),
    days: rawDays.map((d) => Number(d)),
    openingHHMM: formData.get("openingHHMM"),
    closingHHMM: formData.get("closingHHMM"),
    pricePerSlot: formData.get("pricePerSlot"),
  });

  if (!parsed.success) {
    return {
      error: "Dados inválidos. Verifique os campos.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Valida antecipadamente a geração de slots (feedback imediato ao usuário).
  try {
    generateSlotsFromRule(
      parsed.data.openingHHMM,
      parsed.data.closingHHMM,
      Math.round(parsed.data.pricePerSlot * 100)
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Intervalo de horário inválido." };
  }

  try {
    const ctx = arenaContext({ id: session.userId, tenantId: session.tenantId });
    const result = await upsertCourtScheduleRule(ctx, {
      courtId: parsed.data.courtId,
      days: parsed.data.days,
      openingHHMM: parsed.data.openingHHMM,
      closingHHMM: parsed.data.closingHHMM,
      pricePerSlotInCents: Math.round(parsed.data.pricePerSlot * 100),
    });
    return { success: true, slotsCreated: result.slotsCreated };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Erro ao salvar a grade de horários.",
    };
  }
}
