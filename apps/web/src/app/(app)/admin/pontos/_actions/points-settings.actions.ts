"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession, arenaContext } from "@/lib/session";
import { upsertPointsSettings, UpsertPointsSettingsInputSchema } from "@gestao-de-quadras/core/points";

export type PointsSettingsFormState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "success" };

async function requireAdminOrGerente() {
  const session = await requireSession();
  if (!["admin", "gerente"].includes(session.role)) redirect("/negado");
  // Módulo pontos obrigatório (admin tem acesso irrestrito — regra 3)
  if (session.role !== "admin" && !session.modulesAllowed.includes("pontos")) {
    redirect("/negado");
  }
  return arenaContext({ id: session.userId, tenantId: session.tenantId });
}

function parseIntOrNull(value: string | null): number | null {
  if (value === null || value === "" || value === "null") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function upsertPointsSettingsAction(
  _prev: PointsSettingsFormState,
  formData: FormData
): Promise<PointsSettingsFormState> {
  const ctx = await requireAdminOrGerente();

  const raw = {
    enabled: formData.get("enabled") === "on",
    earnRateCentsPerPoint: Number(formData.get("earnRateCentsPerPoint")),
    earnRateCopa: parseIntOrNull(formData.get("earnRateCopa") as string | null),
    earnRateCourtRental: parseIntOrNull(formData.get("earnRateCourtRental") as string | null),
    earnRateClassPackage: parseIntOrNull(formData.get("earnRateClassPackage") as string | null),
    redemptionPointsPerReal: Number(formData.get("redemptionPointsPerReal")),
    maxRedemptionPercentage: Number(formData.get("maxRedemptionPercentage")),
    allowPartialRedemption: formData.get("allowPartialRedemption") === "on",
    allowedParticipants: formData.get("allowedParticipants") as string,
    expirationDays: Number(formData.get("expirationDays")),
  };

  const parsed = UpsertPointsSettingsInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const [key, issues] of Object.entries(parsed.error.flatten().fieldErrors)) {
      fieldErrors[key] = issues ?? [];
    }
    return { status: "error", message: "Dados inválidos. Verifique os campos destacados.", fieldErrors };
  }

  try {
    await upsertPointsSettings(ctx, parsed.data);
    revalidatePath("/admin/pontos");
    return { status: "success" };
  } catch (err) {
    console.error("[upsertPointsSettingsAction]", err);
    return { status: "error", message: "Erro ao salvar configurações. Tente novamente." };
  }
}
