"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession, arenaContext } from "@/lib/session";
import { upsertPrintConfig, UpsertPrintConfigInputSchema } from "@gestao-de-quadras/core/print";

export type PrintConfigFormState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "success" };

async function requireCtx(): Promise<ReturnType<typeof arenaContext>> {
  const session = await requireSession();
  if (!["admin", "gerente"].includes(session.role)) redirect("/negado");
  return arenaContext({ id: session.userId, tenantId: session.tenantId });
}

export async function upsertPrintConfigAction(
  _prev: PrintConfigFormState,
  formData: FormData
): Promise<PrintConfigFormState> {
  const ctx = await requireCtx();

  const raw = {
    paperSize: formData.get("paperSize") as string,
    autoPrintProductionTickets: formData.get("autoPrintProductionTickets") === "on",
    receiptHeader: (formData.get("receiptHeader") as string | null) || null,
    receiptFooter: (formData.get("receiptFooter") as string | null) || null,
  };

  const parsed = UpsertPrintConfigInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const [key, issues] of Object.entries(parsed.error.flatten().fieldErrors)) {
      fieldErrors[key] = issues ?? [];
    }
    return { status: "error", message: "Dados inválidos.", fieldErrors };
  }

  try {
    await upsertPrintConfig(ctx, parsed.data);
    revalidatePath("/admin/impressao");
    return { status: "success" };
  } catch (err) {
    console.error("[upsertPrintConfigAction]", err);
    return { status: "error", message: "Erro ao salvar configurações. Tente novamente." };
  }
}
