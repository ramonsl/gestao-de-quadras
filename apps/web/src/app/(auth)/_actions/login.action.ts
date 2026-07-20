"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { z } from "zod";

const loginSchema = z.object({
  identifier: z.string().min(1, "Informe seu usuário ou e-mail."),
  password: z.string().min(1, "Informe a senha."),
  tenantSlug: z.string().min(1),
});

export type LoginActionState =
  | { status: "idle" }
  | { status: "validation_error"; errors: Record<string, string[]> }
  | { status: "error"; message: string }
  | { status: "success" };

export async function loginAction(
  _prev: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
    tenantSlug: formData.get("tenantSlug"),
  });

  if (!parsed.success) {
    return {
      status: "validation_error",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await signIn("credentials", {
      identifier: parsed.data.identifier,
      password: parsed.data.password,
      tenantSlug: parsed.data.tenantSlug,
      redirectTo: "/usuarios",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { status: "error", message: "Usuário ou senha incorretos. Verifique e tente novamente." };
        default:
          return { status: "error", message: "Erro ao autenticar. Tente novamente." };
      }
    }
    // signIn lança redirect — propagar normalmente
    throw error;
  }

  return { status: "success" };
}
