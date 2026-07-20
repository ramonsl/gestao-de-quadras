"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import {
  createArenaUser,
  updateArenaUser,
  deactivateArenaUser,
  reactivateArenaUser,
  resetArenaUserPassword,
  type CreateArenaUserInput,
  type UpdateArenaUserInput,
} from "@gestao-de-quadras/core/users/user.service";
import { MODULES, type ModuleSlug } from "@gestao-de-quadras/core/users/modules";
import { z } from "zod";

/** userId vem do cliente — validar antes de chegar ao Postgres (evita 500 por cast). */
const userIdSchema = z.string().uuid();

export type UserFormState =
  | { status: "idle" }
  | { status: "validation_error"; errors: Record<string, string[]> }
  | { status: "error"; message: string }
  | { status: "success" };

function readModules(formData: FormData): ModuleSlug[] {
  return MODULES.filter((m) => formData.get(`module_${m}`) === "on");
}

export async function createUserAction(
  _prev: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const { ctx } = await requireAdmin();

  const input: CreateArenaUserInput = {
    name: String(formData.get("name") ?? ""),
    username: String(formData.get("username") ?? ""),
    password: String(formData.get("password") ?? ""),
    email: String(formData.get("email") ?? "") || undefined,
    phone: String(formData.get("phone") ?? "") || undefined,
    role: String(formData.get("role") ?? "atendente") as CreateArenaUserInput["role"],
    modulesAllowed: readModules(formData),
    mustChangePassword: formData.get("mustChangePassword") === "on",
  };

  const result = await createArenaUser(input, ctx);
  if (!result.success) {
    if (result.reason === "validation") {
      return { status: "validation_error", errors: result.errors ?? {} };
    }
    const message =
      result.reason === "username_taken"
        ? "Já existe um usuário com esse login nesta arena."
        : "Já existe um usuário com esse e-mail nesta arena.";
    return { status: "error", message };
  }

  revalidatePath("/usuarios");
  return { status: "success" };
}

export async function updateUserAction(
  userId: string,
  _prev: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const { ctx } = await requireAdmin();

  const input: UpdateArenaUserInput = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? "") || undefined,
    phone: String(formData.get("phone") ?? "") || undefined,
    role: String(formData.get("role") ?? "atendente") as UpdateArenaUserInput["role"],
    modulesAllowed: readModules(formData),
    mustChangePassword: formData.get("mustChangePassword") === "on",
  };

  const result = await updateArenaUser(userId, input, ctx);
  if (!result.success) {
    if (result.reason === "validation") {
      return { status: "validation_error", errors: result.errors ?? {} };
    }
    const message =
      result.reason === "email_taken"
        ? "Já existe um usuário com esse e-mail nesta arena."
        : result.reason === "last_active_admin"
          ? "Não é possível rebaixar o único Admin ativo da arena."
          : "Usuário não encontrado.";
    return { status: "error", message };
  }

  revalidatePath("/usuarios");
  return { status: "success" };
}

export async function deactivateUserAction(userId: string): Promise<UserFormState> {
  const { ctx } = await requireAdmin();
  if (!userIdSchema.safeParse(userId).success) {
    return { status: "error", message: "Usuário não encontrado." };
  }
  const result = await deactivateArenaUser(userId, ctx);
  if (!result.success) {
    const message =
      result.reason === "last_active_admin"
        ? "Não é possível inativar o único Admin ativo da arena."
        : "Usuário não encontrado.";
    return { status: "error", message };
  }
  revalidatePath("/usuarios");
  return { status: "success" };
}

export async function reactivateUserAction(userId: string): Promise<UserFormState> {
  const { ctx } = await requireAdmin();
  if (!userIdSchema.safeParse(userId).success) {
    return { status: "error", message: "Usuário não encontrado." };
  }
  const result = await reactivateArenaUser(userId, ctx);
  if (!result.success) {
    return { status: "error", message: "Usuário não encontrado." };
  }
  revalidatePath("/usuarios");
  return { status: "success" };
}

export async function resetPasswordAction(
  userId: string,
  newPassword: string,
  mustChangePassword: boolean
): Promise<UserFormState> {
  const { ctx } = await requireAdmin();
  if (!userIdSchema.safeParse(userId).success) {
    return { status: "error", message: "Usuário não encontrado." };
  }
  const result = await resetArenaUserPassword(userId, newPassword, ctx, { mustChangePassword });
  if (!result.success) {
    const message =
      result.reason === "weak_password"
        ? "A senha deve ter ao menos 8 caracteres."
        : "Usuário não encontrado.";
    return { status: "error", message };
  }
  revalidatePath("/usuarios");
  return { status: "success" };
}
