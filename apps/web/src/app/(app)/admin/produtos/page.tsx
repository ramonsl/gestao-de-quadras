import { requireSession, arenaContext } from "@/lib/session";
import { listProducts, getProductsWithLowStock } from "@gestao-de-quadras/core/product";
import Link from "next/link";
import { ProductsList } from "@/components/products/products-list";
import { LowStockAlert } from "@/components/products/low-stock-alert";

export default async function ProdutosPage() {
  const session = await requireSession();
  const ctx = arenaContext({ id: session.userId, tenantId: session.tenantId });

  const products = await listProducts({}, ctx);
  const lowStockProducts = await getProductsWithLowStock(ctx);

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center justify-between bg-white border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-1)]">Produtos</h1>
        <Link
          href="/admin/produtos/novo"
          className="inline-flex items-center h-9 px-4 text-sm font-semibold text-white rounded-[var(--radius-button)] transition-colors duration-[180ms]"
          style={{ backgroundColor: "var(--accent)" }}
        >
          Novo produto
        </Link>
      </header>

      <main className="flex-1 min-h-0 overflow-auto p-[22px] space-y-4">
        <p className="text-[11px] text-[var(--text-3)]">
          Catálogo de produtos da copa, artigos esportivos e controle de estoque (CAD-02).
        </p>

        {lowStockProducts.length > 0 && <LowStockAlert products={lowStockProducts} />}

        <ProductsList products={products} />
      </main>
    </>
  );
}
