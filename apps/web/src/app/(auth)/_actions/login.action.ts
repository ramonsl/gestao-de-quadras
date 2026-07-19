"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido."),
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
    email: formData.get("email"),
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
      email: parsed.data.email,
      password: parsed.data.password,
      tenantSlug: parsed.data.tenantSlug,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { status: "error", message: "E-mail ou senha incorretos. Verifique e tente novamente." };
        default:
          return { status: "error", message: "Erro ao autenticar. Tente novamente." };
      }
    }
    // signIn lança redirect — propagar normalmente
    throw error;
  }

  return { status: "success" };
}
