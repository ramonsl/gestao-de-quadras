"use server";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@gestao-de-quadras/db";
import { createCourtService } from "@gestao-de-quadras/core/courts/court-service.service";
import { z } from "zod";

const CreateServiceSchema = z.object({
  courtId: z.string().uuid("Quadra inválida"),
  serviceType: z.enum(["rental", "single_class", "package"], {
    errorMap: () => ({ message: "Tipo de serviço inválido" }),
  }),
  basePriceInCents: z.coerce.number().positive("Preço deve ser maior que 0"),
});

export async function createServiceAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (!["admin", "gerente"].includes(session.user.role ?? "")) {
    throw new Error("Acesso negado");
  }

  const courtId = formData.get("courtId");
  const serviceType = formData.get("serviceType");
  const basePriceInCents = formData.get("basePriceInCents");

  const result = CreateServiceSchema.safeParse({
    courtId,
    serviceType,
    basePriceInCents,
  });

  if (!result.success) {
    return { error: result.error.flatten().fieldErrors };
  }

  try {
    const ctx = { db, tenantId: session.user.tenantId, actorUserId: session.user.id };
    const service = await createCourtService(ctx, {
      courtId: result.data.courtId,
      serviceType: result.data.serviceType,
      basePriceInCents: Math.round(result.data.basePriceInCents * 100),
    });

    return { success: true, service };
  } catch (error) {
    return { error: "Erro ao criar serviço" };
  }
}
