"use server";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@gestao-de-quadras/db";
import { createCourtTimeSlot } from "@gestao-de-quadras/core/courts/court-time-slot.service";
import { z } from "zod";

const TimeFormatRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

const CreateTimeSlotSchema = z
  .object({
    courtId: z.string().uuid("Quadra inválida"),
    dayOfWeek: z.coerce.number().min(0).max(6),
    startTimeHHMM: z.string().regex(TimeFormatRegex, "Formato HH:MM inválido"),
    endTimeHHMM: z.string().regex(TimeFormatRegex, "Formato HH:MM inválido"),
    durationMinutes: z.coerce.number().positive("Duração deve ser maior que 0"),
    priceInCents: z.coerce.number().positive("Preço deve ser maior que 0"),
  })
  .refine(
    (data) => {
      const start = data.startTimeHHMM.split(":").map(Number);
      const end = data.endTimeHHMM.split(":").map(Number);
      return start[0] * 60 + start[1] < end[0] * 60 + end[1];
    },
    { message: "Hora de início deve ser anterior à de fim" }
  );

export async function createTimeSlotAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (!["admin", "gerente"].includes(session.user.role ?? "")) {
    throw new Error("Acesso negado");
  }

  const courtId = formData.get("courtId");
  const dayOfWeek = formData.get("dayOfWeek");
  const startTimeHHMM = formData.get("startTimeHHMM");
  const endTimeHHMM = formData.get("endTimeHHMM");
  const durationMinutes = formData.get("durationMinutes");
  const priceInCents = formData.get("priceInCents");

  const result = CreateTimeSlotSchema.safeParse({
    courtId,
    dayOfWeek,
    startTimeHHMM,
    endTimeHHMM,
    durationMinutes,
    priceInCents,
  });

  if (!result.success) {
    return { error: result.error.flatten().fieldErrors };
  }

  try {
    const ctx = { db, schemaName: `tenant_${session.user.tenantSlug}`, actorUserId: session.user.id };
    const slot = await createCourtTimeSlot(ctx, {
      courtId: result.data.courtId,
      dayOfWeek: result.data.dayOfWeek as any,
      startTimeHHMM: result.data.startTimeHHMM,
      endTimeHHMM: result.data.endTimeHHMM,
      durationMinutes: result.data.durationMinutes,
      priceInCents: Math.round(result.data.priceInCents * 100),
    });

    return { success: true, slot };
  } catch (error) {
    return { error: "Erro ao criar faixa horária" };
  }
}
