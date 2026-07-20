import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTenantDb } from "@gestao-de-quadras/db";
import { listProducts, getProductsWithLowStock } from "@gestao-de-quadras/core/product";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ProductsList } from "@/components/products/products-list";
import { LowStockAlert } from "@/components/products/low-stock-alert";

export default async function ProdutosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["admin", "gerente"].includes(session.user.role ?? "")) redirect("/dashboard");

  const tenantDb = getTenantDb(session.user.tenantSlug!);
  const allProducts = await listProducts({}, tenantDb);
  const lowStockProducts = await getProductsWithLowStock(tenantDb);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Produtos da Copa</h1>
        <Link href="/admin/produtos/novo">
          <Button>Novo Produto</Button>
        </Link>
      </div>
      {lowStockProducts.length > 0 && <LowStockAlert products={lowStockProducts} />}
      <ProductsList products={allProducts} />
    </div>
  );
}
