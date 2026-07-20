"use server";

import { z } from "zod";
import { db } from "@gestao-de-quadras/db";
import { resetPassword } from "@gestao-de-quadras/core/auth/auth.service";

const schema = z.object({
  token: z.string().min(1),
  tenantSlug: z.string().min(1),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"],
});

export type ResetPasswordActionState =
  | { status: "idle" }
  | { status: "validation_error"; errors: Record<string, string[]> }
  | { status: "error"; message: string }
  | { status: "success" };

export async function resetPasswordAction(
  _prev: ResetPasswordActionState,
  formData: FormData
): Promise<ResetPasswordActionState> {
  const parsed = schema.safeParse({
    token: formData.get("token"),
    tenantSlug: formData.get("tenantSlug"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { status: "validation_error", errors: parsed.error.flatten().fieldErrors };
  }

  const result = await resetPassword(
    parsed.data.token,
    parsed.data.password,
    `tenant_${parsed.data.tenantSlug}`,
    db
  );

  if (!result.success) {
    const message =
      result.reason === "token_expired"
        ? "Link expirado. Solicite um novo e-mail de recuperação."
        : "Link inválido. Solicite um novo e-mail de recuperação.";
    return { status: "error", message };
  }

  return { status: "success" };
}
