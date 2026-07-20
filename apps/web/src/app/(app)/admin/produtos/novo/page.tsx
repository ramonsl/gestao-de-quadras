import { requireSession } from "@/lib/session";
import { ProductForm } from "@/components/products/product-form";
import { createProductAction } from "../_actions/create-product.action";

export default async function Page() {
  await requireSession();

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center bg-white border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-1)]">Novo produto</h1>
      </header>

      <main className="flex-1 min-h-0 overflow-auto p-[22px]">
        <ProductForm action={createProductAction} />
      </main>
    </>
  );
}
