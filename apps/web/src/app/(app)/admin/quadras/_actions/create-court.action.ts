"use server";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { arenaContext } from "@/lib/session";
import { createCourt } from "@gestao-de-quadras/core/courts/court.service";
import { z } from "zod";

const CreateCourtSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100),
  modality: z.string().min(1, "Modalidade é obrigatória").max(50),
});

export async function createCourtAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (!["admin", "gerente"].includes(session.user.role ?? "")) {
    throw new Error("Acesso negado");
  }

  const result = CreateCourtSchema.safeParse({
    name: formData.get("name"),
    modality: formData.get("modality"),
  });

  if (!result.success) {
    return { error: result.error.flatten().fieldErrors };
  }

  const ctx = arenaContext(session.user);
  await createCourt(ctx, {
    name: result.data.name,
    modality: result.data.modality,
  });

  revalidatePath("/admin/quadras");
  redirect("/admin/quadras");
}
