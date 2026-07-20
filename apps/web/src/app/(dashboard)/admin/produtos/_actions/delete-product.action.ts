"use server";

import { auth } from "@/auth";
import { getTenantDb } from "@gestao-de-quadras/db";
import { deleteProduct } from "@gestao-de-quadras/core/product/product.service";

export type DeleteProductState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success" };

export async function deleteProductAction(
  productId: string
): Promise<DeleteProductState> {
  const session = await auth();
  if (!session?.user?.email || !session?.user?.tenantSlug) {
    return { status: "error", message: "Não autenticado" };
  }

  if (!["admin", "gerente"].includes(session.user.role ?? "")) {
    return { status: "error", message: "Permissão negada" };
  }

  try {
    const tenantDb = getTenantDb(session.user.tenantSlug);
    const deleted = await deleteProduct(productId, tenantDb, session.user.id);

    if (!deleted) {
      return { status: "error", message: "Produto não encontrado" };
    }

    return { status: "success" };
  } catch (error) {
    console.error("Erro ao deletar produto:", error);
    return { status: "error", message: "Erro ao deletar produto" };
  }
}
