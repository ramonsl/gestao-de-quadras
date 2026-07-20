"use server";

import { z } from "zod";
import { db } from "@gestao-de-quadras/db";
import { activateAccount } from "@gestao-de-quadras/core/auth/auth.service";
import { resolveTenantFromHost } from "@/lib/tenant";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"],
});

export type ActivateAccountActionState =
  | { status: "idle" }
  | { status: "validation_error"; errors: Record<string, string[]> }
  | { status: "error"; message: string }
  | { status: "success" };

export async function activateAccountAction(
  _prev: ActivateAccountActionState,
  formData: FormData
): Promise<ActivateAccountActionState> {
  const parsed = schema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { status: "validation_error", errors: parsed.error.flatten().fieldErrors };
  }

  const tenant = await resolveTenantFromHost();
  if (!tenant) {
    return { status: "error", message: "Arena não identificada. Verifique o endereço de acesso." };
  }

  const result = await activateAccount(
    parsed.data.token,
    parsed.data.password,
    tenant.id,
    db
  );

  if (!result.success) {
    const message =
      result.reason === "token_expired"
        ? "O link de ativação expirou. Peça ao administrador para enviar um novo convite."
        : "Link de ativação inválido.";
    return { status: "error", message };
  }

  return { status: "success" };
}
