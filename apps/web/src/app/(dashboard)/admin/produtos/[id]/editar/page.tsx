import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTenantDb } from "@gestao-de-quadras/db";
import { getProductById } from "@gestao-de-quadras/core/product/product.service";
import { ProductForm } from "@/components/products/product-form";
import { updateProductAction } from "../../_actions/update-product.action";

export default async function EditarProdutoPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (!["admin", "gerente"].includes(session.user.role ?? "")) {
    redirect("/dashboard");
  }

  const tenantDb = getTenantDb(session.user.tenantSlug!);
  const product = await getProductById(params.id, tenantDb);

  if (!product) {
    redirect("/admin/produtos");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Editar Produto</h1>
      <ProductForm
        action={(prev: any, formData: FormData) =>
          updateProductAction(product.id, prev, formData)
        }
        initialData={{
          id: product.id,
          name: product.name,
          barcode: product.barcode,
          salePriceCents: product.salePriceCents,
          category: product.category,
          currentStock: product.currentStock,
          minStock: product.minStock,
        }}
      />
    </div>
  );
}
