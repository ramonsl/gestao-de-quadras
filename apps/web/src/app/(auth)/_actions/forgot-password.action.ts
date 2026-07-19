"use server";

import { z } from "zod";
import { db } from "@gestao-de-quadras/db";
import { createPasswordResetToken } from "@gestao-de-quadras/core/auth/auth.service";
import { ResendEmailProvider } from "@gestao-de-quadras/core/email/email.provider";
import { tenants } from "@gestao-de-quadras/db/schema";
import { eq } from "drizzle-orm";

const schema = z.object({
  email: z.string().email("E-mail inválido."),
  tenantSlug: z.string().min(1),
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
    tenantSlug: formData.get("tenantSlug"),
  });

  if (!parsed.success) {
    return { status: "validation_error", errors: parsed.error.flatten().fieldErrors };
  }

  const { email, tenantSlug } = parsed.data;

  const token = await createPasswordResetToken(email, db);

  // Sempre retornar "sent" — não revelar se o e-mail existe (segurança)
  if (!token) {
    return { status: "sent" };
  }

  const [tenant] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const resetUrl = `${baseUrl}/redefinir-senha/${token}?tenant=${tenantSlug}`;

  const emailProvider = new ResendEmailProvider(process.env.RESEND_API_KEY!);
  await emailProvider.sendPasswordResetEmail({
    to: email,
    resetUrl,
    arenaName: tenant?.name ?? tenantSlug,
  });

  return { status: "sent" };
}
