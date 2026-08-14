import { notFound } from "next/navigation";
import { requireModule } from "@/lib/session";
import { getComandaWithItems } from "@gestao-de-quadras/core/pdv";
import { listProducts } from "@gestao-de-quadras/core/product";
import { getPrintConfig } from "@gestao-de-quadras/core/print";
import { ComandaWorkspace } from "./_components/comanda-workspace";

/** PDV-02/PDV-03: tela de lançamento de itens numa comanda aberta. */
export default async function ComandaPage({
  params,
}: {
  params: Promise<{ comandaId: string }>;
}) {
  const { comandaId } = await params;
  const { session, ctx } = await requireModule("pdv");

  const [comanda, products, printConfig] = await Promise.all([
    getComandaWithItems(ctx, comandaId),
    listProducts(undefined, ctx),
    getPrintConfig(ctx),
  ]);
  if (!comanda) notFound();

  return (
    <main className="flex-1 p-[22px]">
      <ComandaWorkspace
        comanda={comanda}
        products={products}
        userRole={session.role}
        printConfig={printConfig}
      />
    </main>
  );
}
