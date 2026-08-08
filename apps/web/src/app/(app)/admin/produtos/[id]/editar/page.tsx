import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { arenaContext } from "@/lib/session";
import { getProductById } from "@gestao-de-quadras/core/product";
import { ProductForm } from "@/components/products/product-form";
import { updateProductAction } from "../../_actions/update-product.action";

export default async function EditarProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["admin", "gerente"].includes(session.user.role ?? "")) redirect("/dashboard");

  const ctx = arenaContext(session.user);
  const product = await getProductById(id, ctx);
  if (!product) redirect("/admin/produtos");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Editar Produto</h1>
      <ProductForm
        action={(prev: any, formData: FormData) => updateProductAction(product.id, prev, formData)}
        initialData={product}
      />
    </div>
  );
}
