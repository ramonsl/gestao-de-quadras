"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { arenaContext } from "@/lib/session";
import {
  createAdvertiser,
  updateAdvertiser,
  deleteAdvertiser,
} from "@gestao-de-quadras/core/publicidade/advertiser.service";
import { z } from "zod";

export type AdvertiserFormState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "success" };

const Schema = z.object({
  name: z.string().trim().min(1, "Informe a razão social/nome."),
  document: z
    .string()
    .trim()
    .min(1, "Informe o CNPJ/CPF.")
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 11 || v.length === 14, {
      message: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).",
    }),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
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
  return Schema.safeParse({
    name: formData.get("name"),
    document: formData.get("document"),
    email: formData.get("email") ?? undefined,
    phone: formData.get("phone") ?? undefined,
  });
}

export async function createAdvertiserAction(
  _prev: AdvertiserFormState,
  formData: FormData
): Promise<AdvertiserFormState> {
  const ctx = await requireCtx();
  const parsed = parse(formData);
  if (!parsed.success) {
    return { status: "error", message: "Dados inválidos", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    const res = await createAdvertiser(parsed.data, ctx);
    if (!res.success) {
      return { status: "error", message: "Documento já cadastrado.", fieldErrors: { document: ["Já existe um anunciante com este CNPJ/CPF."] } };
    }
  } catch {
    return { status: "error", message: "Erro ao criar o anunciante." };
  }
  revalidatePath("/admin/publicidade/anunciantes");
  redirect("/admin/publicidade/anunciantes");
}

export async function updateAdvertiserAction(
  id: string,
  _prev: AdvertiserFormState,
  formData: FormData
): Promise<AdvertiserFormState> {
  const ctx = await requireCtx();
  const parsed = parse(formData);
  if (!parsed.success) {
    return { status: "error", message: "Dados inválidos", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    const res = await updateAdvertiser(id, parsed.data, ctx);
    if (!res.success) {
      const message = res.reason === "document_taken" ? "Documento já cadastrado." : "Anunciante não encontrado.";
      const fieldErrors = res.reason === "document_taken" ? { document: ["Já existe um anunciante com este CNPJ/CPF."] } : undefined;
      return { status: "error", message, fieldErrors };
    }
  } catch {
    return { status: "error", message: "Erro ao atualizar o anunciante." };
  }
  revalidatePath("/admin/publicidade/anunciantes");
  redirect("/admin/publicidade/anunciantes");
}

export async function deleteAdvertiserAction(id: string): Promise<{ status: "success" | "error"; message?: string }> {
  const ctx = await requireCtx();
  try {
    const deleted = await deleteAdvertiser(id, ctx);
    if (!deleted) return { status: "error", message: "Anunciante não encontrado." };
  } catch {
    return { status: "error", message: "Erro ao excluir o anunciante." };
  }
  revalidatePath("/admin/publicidade/anunciantes");
  return { status: "success" };
}
