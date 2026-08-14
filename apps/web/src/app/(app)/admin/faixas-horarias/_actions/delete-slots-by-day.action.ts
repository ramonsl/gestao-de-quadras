"use server";

import { requireSession, arenaContext } from "@/lib/session";
import { deleteTimeSlotsByDay } from "@gestao-de-quadras/core/courts/court-time-slot.service";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const DeleteDaySchema = z.object({
  courtId: z.string().uuid("Quadra inválida"),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
});

export async function deleteSlotsByDayAction(formData: FormData) {
  const session = await requireSession();
  if (!["admin", "gerente"].includes(session.role)) {
    throw new Error("Acesso negado");
  }

  const parsed = DeleteDaySchema.safeParse({
    courtId: formData.get("courtId"),
    dayOfWeek: formData.get("dayOfWeek"),
  });

  if (!parsed.success) {
    throw new Error("Dados inválidos");
  }

  const ctx = arenaContext({ id: session.userId, tenantId: session.tenantId });
  await deleteTimeSlotsByDay(ctx, parsed.data.courtId, [parsed.data.dayOfWeek]);
  revalidatePath("/admin/faixas-horarias");
}
