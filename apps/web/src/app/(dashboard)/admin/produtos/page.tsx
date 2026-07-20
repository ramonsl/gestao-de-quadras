import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTenantDb } from "@gestao-de-quadras/db";
import { listProducts, getProductsWithLowStock } from "@gestao-de-quadras/core/product";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ProductsList } from "@/components/products/products-list";
import { LowStockAlert } from "@/components/products/low-stock-alert";

export default async function ProdutosPage() {
  const s = await auth();
  if (!s?.user) redirect("/login");
  if (!["admin", "gerente"].includes(s.user.role ?? "")) redirect("/dashboard");

  const db = getTenantDb(s.user.tenantSlug!);
  const all = await listProducts({}, db);
  const low = await getProductsWithLowStock(db);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Produtos</h1>
        <Link href="/admin/produtos/novo"><Button>Novo</Button></Link>
      </div>
      {low.length > 0 && <LowStockAlert products={low} />}
      <ProductsList products={all} />
    </div>
  );
}
