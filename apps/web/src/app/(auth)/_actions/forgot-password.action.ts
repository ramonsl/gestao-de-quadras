"use server";

import { z } from "zod";
import { db } from "@gestao-de-quadras/db";
import { createPasswordResetToken } from "@gestao-de-quadras/core/auth/auth.service";
import { ResendEmailProvider } from "@gestao-de-quadras/core/email/email.provider";
import { resolveTenantFromHost } from "@/lib/tenant";

const schema = z.object({
  email: z.string().email("E-mail inválido."),
});

export type ForgotPasswordActionState =
  | { status: "idle" }
  | { status: "validation_error"; errors: Record<string, string[]> }
  | { status: "sent" };

export async function forgotPasswordAction(
  _prev: ForgotPasswordActionState,
  formData: FormData
): Promise<ForgotPasswordActionState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { status: "validation_error", errors: parsed.error.flatten().fieldErrors };
  }

  const { email } = parsed.data;

  // O tenant vem do Host, nunca do formulário. Sem arena identificada,
  // responder como se tivesse enviado (não revelar nada).
  const tenant = await resolveTenantFromHost();
  if (!tenant) {
    return { status: "sent" };
  }

  const token = await createPasswordResetToken(email, tenant.id, db);

  // Sempre retornar "sent" — não revelar se o e-mail existe (segurança)
  if (!token) {
    return { status: "sent" };
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const resetUrl = `${baseUrl}/redefinir-senha/${token}?tenant=${tenant.slug}`;

  const emailProvider = new ResendEmailProvider(process.env.RESEND_API_KEY!);
  await emailProvider.sendPasswordResetEmail({
    to: email,
    resetUrl,
    arenaName: tenant.name,
  });

  return { status: "sent" };
}
