import { notFound } from "next/navigation";
import { requireModule } from "@/lib/session";
import { getComandaWithItems } from "@gestao-de-quadras/core/pdv";
import { listProducts } from "@gestao-de-quadras/core/product";
import { ComandaWorkspace } from "./_components/comanda-workspace";

/** PDV-02/PDV-03: tela de lançamento de itens numa comanda aberta. */
export default async function ComandaPage({
  params,
}: {
  params: Promise<{ comandaId: string }>;
}) {
  const { comandaId } = await params;
  const { ctx } = await requireModule("pdv");

  const comanda = await getComandaWithItems(ctx, comandaId);
  if (!comanda) notFound();

  const products = await listProducts(undefined, ctx);

  return (
    <main className="flex-1 p-[22px]">
      <ComandaWorkspace comanda={comanda} products={products} />
    </main>
  );
}
