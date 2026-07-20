"use server";

import { auth } from "@/auth";
import { getTenantDb } from "@gestao-de-quadras/db";
import { createProduct, createProductInput } from "@gestao-de-quadras/core/product";

export type CreateProductState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "success"; productId: string };

export async function createProductAction(
  _prev: CreateProductState,
  formData: FormData
): Promise<CreateProductState> {
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
    currentStock: parseInt(formData.get("currentStock") as string) || 0,
    minStock: parseInt(formData.get("minStock") as string) || 0,
  };

  const parsed = createProductInput.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Dados inválidos",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const tenantDb = getTenantDb(session.user.tenantSlug);
    const product = await createProduct(parsed.data, tenantDb, session.user.id);
    return { status: "success", productId: product.id };
  } catch (error) {
    console.error("Erro ao criar produto:", error);
    return { status: "error", message: "Erro ao criar produto" };
  }
}
