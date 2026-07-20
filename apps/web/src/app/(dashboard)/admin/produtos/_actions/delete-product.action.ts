"use server";

import { auth } from "@/auth";
import { db } from "@gestao-de-quadras/db";
import { deleteProduct } from "@gestao-de-quadras/core/product";

export async function deleteProductAction(productId: string) {
  const session = await auth();
  if (!session?.user?.email || !session?.user?.tenantSlug) {
    return { status: "error", message: "Não autenticado" };
  }

  if (!["admin", "gerente"].includes(session.user.role ?? "")) {
    return { status: "error", message: "Permissão negada" };
  }

  try {
    const ctx = { db, schemaName: `tenant_${session.user.tenantSlug}`, actorUserId: session.user.id };
    const deleted = await deleteProduct(productId, ctx);
    if (!deleted) return { status: "error", message: "Produto não encontrado" };
    return { status: "success" };
  } catch (error) {
    console.error("Erro ao deletar produto:", error);
    return { status: "error", message: "Erro ao deletar produto" };
  }
}
