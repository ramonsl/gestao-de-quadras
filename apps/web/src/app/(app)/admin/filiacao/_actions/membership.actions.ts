"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { transactionalDb } from "@gestao-de-quadras/db";
import {
  CreateCustomerMembershipInputSchema,
  SaveMembershipPlanInputSchema,
  createCustomerMembership,
  deactivateMembershipPlan,
  endCustomerMembership,
  saveMembershipPlan,
} from "@gestao-de-quadras/core/membership";

export type MembershipActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const asText = (formData: FormData, name: string): string => String(formData.get(name) ?? "").trim();

async function inTransaction<T>(
  ctx: Awaited<ReturnType<typeof requireAdmin>>["ctx"],
  operation: (transactionContext: typeof ctx) => Promise<T>
): Promise<T> {
  return transactionalDb.transaction(
    async (tx) => operation({ ...ctx, db: tx as unknown as typeof ctx.db }),
    { isolationLevel: "serializable" }
  );
}

export async function saveMembershipPlanAction(
  _previous: MembershipActionState,
  formData: FormData
): Promise<MembershipActionState> {
  const { ctx } = await requireAdmin();
  const parsed = SaveMembershipPlanInputSchema.safeParse({
    id: asText(formData, "id") || undefined,
    name: asText(formData, "name"),
    description: asText(formData, "description"),
    cyclePriceCents: Number(formData.get("cyclePriceCents")),
    billingPeriod: asText(formData, "billingPeriod"),
    productDiscountPercent: Number(formData.get("productDiscountPercent")),
    courtRentalDiscountPercent: Number(formData.get("courtRentalDiscountPercent")),
    classPackageDiscountPercent: Number(formData.get("classPackageDiscountPercent")),
    productCategories: asText(formData, "productCategories")
      .split(",")
      .map((category) => category.trim())
      .filter(Boolean),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  try {
    await inTransaction(ctx, (transactionContext) => saveMembershipPlan(transactionContext, parsed.data));
    revalidatePath("/admin/filiacao");
    return { status: "success", message: parsed.data.id ? "Plano atualizado." : "Plano criado." };
  } catch (error) {
    console.error("[saveMembershipPlanAction]", error);
    return { status: "error", message: "Não foi possível salvar o plano." };
  }
}

export async function createCustomerMembershipAction(
  _previous: MembershipActionState,
  formData: FormData
): Promise<MembershipActionState> {
  const { ctx } = await requireAdmin();
  const parsed = CreateCustomerMembershipInputSchema.safeParse({
    customerId: asText(formData, "customerId"),
    membershipPlanId: asText(formData, "membershipPlanId"),
    startsOn: asText(formData, "startsOn"),
    endsOn: asText(formData, "endsOn") || null,
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  try {
    const result = await inTransaction(ctx, (transactionContext) =>
      createCustomerMembership(transactionContext, parsed.data)
    );
    if (!result.success) {
      const messages = {
        customer_not_found: "Cliente não encontrado nesta arena.",
        plan_not_found_or_inactive: "Plano não encontrado ou inativo.",
        already_active: "Este cliente já possui uma filiação ativa.",
      };
      return { status: "error", message: messages[result.reason] };
    }
    revalidatePath("/admin/filiacao");
    return { status: "success", message: "Cliente vinculado ao plano." };
  } catch (error) {
    console.error("[createCustomerMembershipAction]", error);
    return { status: "error", message: "Não foi possível criar a filiação." };
  }
}

export async function deactivateMembershipPlanAction(formData: FormData): Promise<void> {
  const { ctx } = await requireAdmin();
  await inTransaction(ctx, (transactionContext) =>
    deactivateMembershipPlan(transactionContext, asText(formData, "planId"))
  );
  revalidatePath("/admin/filiacao");
}

export async function updateMembershipPlanAction(formData: FormData): Promise<void> {
  await saveMembershipPlanAction({ status: "idle" }, formData);
}

export async function endCustomerMembershipAction(formData: FormData): Promise<void> {
  const { ctx } = await requireAdmin();
  await inTransaction(ctx, (transactionContext) =>
    endCustomerMembership(transactionContext, asText(formData, "membershipId"))
  );
  revalidatePath("/admin/filiacao");
}
