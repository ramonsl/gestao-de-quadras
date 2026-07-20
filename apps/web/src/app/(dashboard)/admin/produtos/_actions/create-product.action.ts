"use server";
import { auth } from "@/auth";
import { getTenantDb } from "@gestao-de-quadras/db";
import { createProduct, createProductInput } from "@gestao-de-quadras/core/product";

type CreateProductState = { status: "error" | "success" | "idle"; message?: string; productId?: string };

export async function createProductAction(_prev: CreateProductState, formData: FormData): Promise<CreateProductState> {
  const s = await auth();
  if (!s?.user?.tenantSlug) return { status: "error", message: "Não autenticado" };
  if (!["admin", "gerente"].includes(s.user.role ?? "")) return { status: "error", message: "Permissão negada" };

  const input = {
    name: formData.get("name"),
    barcode: formData.get("barcode") || null,
    salePriceCents: parseInt(formData.get("salePriceCents") as string) || 0,
    category: formData.get("category"),
    currentStock: parseInt(formData.get("currentStock") as string) || 0,
    minStock: parseInt(formData.get("minStock") as string) || 0,
  };

  const parsed = createProductInput.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Dados inválidos", fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    const p = await createProduct(parsed.data, getTenantDb(s.user.tenantSlug), s.user.id);
    return { status: "success", productId: p.id };
  } catch (e) {
    return { status: "error", message: "Erro ao criar" };
  }
}
