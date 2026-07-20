"use server";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@gestao-de-quadras/db";
import { createClassPackage } from "@gestao-de-quadras/core/classes/class-package.service";
import { z } from "zod";

const CreatePackageSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100),
  totalClassCount: z.coerce.number().positive("Deve ser maior que 0"),
  priceInCents: z.coerce.number().positive("Preço deve ser maior que 0"),
});

export async function createPackageAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (!["admin"].includes(session.user.role ?? "")) {
    throw new Error("Acesso negado");
  }

  const name = formData.get("name");
  const totalClassCount = formData.get("totalClassCount");
  const priceInCents = formData.get("priceInCents");

  const result = CreatePackageSchema.safeParse({
    name,
    totalClassCount,
    priceInCents,
  });

  if (!result.success) {
    return { error: result.error.flatten().fieldErrors };
  }

  try {
    const ctx = { db, schemaName: `tenant_${session.user.tenantSlug}`, actorUserId: session.user.id };
    const classPackage = await createClassPackage(ctx, {
      name: result.data.name,
      totalClassCount: result.data.totalClassCount,
      priceInCents: Math.round(result.data.priceInCents * 100),
    });

    return { success: true, classPackage };
  } catch (error) {
    return { error: "Erro ao criar pacote de aulas" };
  }
}
