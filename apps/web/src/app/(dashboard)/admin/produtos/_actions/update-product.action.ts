"use server";

import { auth } from "@/auth";
import { getTenantDb } from "@gestao-de-quadras/db";
import { updateProduct, updateProductInput } from "@gestao-de-quadras/core/product";

export type UpdateProductState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "success"; productId: string };

export async function updateProductAction(
  productId: string,
  _prev: UpdateProductState,
  formData: FormData
): Promise<UpdateProductState> {
  const session = await auth();
  if (!session?.user?.email || !session?.user?.tenantSlug) {
    return { status: "error", message: "Não autenticado" };
  }

  if (!["admin", "gerente"].includes(session.user.role ?? "")) {
    return { status: "error", message: "Permissão negada" };
  }

  const input = {
    name: formData.get("name"),
    barcode: formData.get("barcode") || null,
    salePriceCents: parseInt(formData.get("salePriceCents") as string) || undefined,
    category: formData.get("category"),
    currentStock: parseInt(formData.get("currentStock") as string) || undefined,
    minStock: parseInt(formData.get("minStock") as string) || undefined,
  };

  const parsed = updateProductInput.safeParse(input);
  if (!parsed.success) {
    const flatErrors = parsed.error.flatten().fieldErrors;
    // TypeScript limitation: Zod's flatten() returns ZodFormattedError which is compatible with Record<string, string[]>
    return {
      status: "error",
      message: "Dados inválidos",
      fieldErrors: flatErrors as unknown as Record<string, string[]>,
    };
  }

  try {
    const tenantDb = getTenantDb(session.user.tenantSlug);
    const product = await updateProduct(productId, parsed.data, tenantDb, session.user.id);
    if (!product) return { status: "error", message: "Produto não encontrado" };
    return { status: "success", productId: product.id };
  } catch (error) {
    console.error("Erro ao atualizar produto:", error);
    return { status: "error", message: "Erro ao atualizar produto" };
  }
}
