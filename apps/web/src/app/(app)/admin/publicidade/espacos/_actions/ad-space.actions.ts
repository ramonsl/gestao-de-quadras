"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { arenaContext } from "@/lib/session";
import {
  createAdSpace,
  updateAdSpace,
  deleteAdSpace,
  AD_SPACE_TYPES,
  AD_SPACE_STATUSES,
} from "@gestao-de-quadras/core/publicidade/ad-space.service";
import { z } from "zod";

export type AdSpaceFormState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "success" };

const Schema = z.object({
  name: z.string().trim().min(1, "Informe a identificação do espaço."),
  spaceType: z.enum(AD_SPACE_TYPES, { errorMap: () => ({ message: "Tipo inválido." }) }),
  status: z.enum(AD_SPACE_STATUSES, { errorMap: () => ({ message: "Status inválido." }) }),
  /** valor em reais (aceita vírgula) → convertido para centavos */
  referencePrice: z.coerce.number().positive("Valor de referência deve ser maior que zero."),
});

async function requireCtx() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["admin", "gerente"].includes(session.user.role ?? "")) {
    throw new Error("Acesso negado");
  }
  return arenaContext(session.user);
}

function parse(formData: FormData) {
  const raw = {
    name: formData.get("name"),
    spaceType: formData.get("spaceType"),
    status: formData.get("status") ?? "disponivel",
    referencePrice: String(formData.get("referencePrice") ?? "").replace(",", "."),
  };
  return Schema.safeParse(raw);
}

export async function createAdSpaceAction(
  _prev: AdSpaceFormState,
  formData: FormData
): Promise<AdSpaceFormState> {
  const ctx = await requireCtx();
  const parsed = parse(formData);
  if (!parsed.success) {
    return { status: "error", message: "Dados inválidos", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    await createAdSpace(
      {
        name: parsed.data.name,
        spaceType: parsed.data.spaceType,
        status: parsed.data.status,
        referencePriceCents: Math.round(parsed.data.referencePrice * 100),
      },
      ctx
    );
  } catch {
    return { status: "error", message: "Erro ao criar o espaço." };
  }
  revalidatePath("/admin/publicidade/espacos");
  redirect("/admin/publicidade/espacos");
}

export async function updateAdSpaceAction(
  id: string,
  _prev: AdSpaceFormState,
  formData: FormData
): Promise<AdSpaceFormState> {
  const ctx = await requireCtx();
  const parsed = parse(formData);
  if (!parsed.success) {
    return { status: "error", message: "Dados inválidos", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    const updated = await updateAdSpace(
      id,
      {
        name: parsed.data.name,
        spaceType: parsed.data.spaceType,
        status: parsed.data.status,
        referencePriceCents: Math.round(parsed.data.referencePrice * 100),
      },
      ctx
    );
    if (!updated) return { status: "error", message: "Espaço não encontrado." };
  } catch {
    return { status: "error", message: "Erro ao atualizar o espaço." };
  }
  revalidatePath("/admin/publicidade/espacos");
  redirect("/admin/publicidade/espacos");
}

export async function deleteAdSpaceAction(id: string): Promise<{ status: "success" | "error"; message?: string }> {
  const ctx = await requireCtx();
  try {
    const deleted = await deleteAdSpace(id, ctx);
    if (!deleted) return { status: "error", message: "Espaço não encontrado." };
  } catch {
    return { status: "error", message: "Erro ao excluir o espaço." };
  }
  revalidatePath("/admin/publicidade/espacos");
  return { status: "success" };
}
