import { notFound } from "next/navigation";
import { requireModule } from "@/lib/session";
import { getComandaWithItems } from "@gestao-de-quadras/core/pdv";
import { listProducts } from "@gestao-de-quadras/core/product";
import { getActiveClassPackages } from "@gestao-de-quadras/core/classes/class-package.service";
import { getActiveBalancesForCustomer } from "@gestao-de-quadras/core/classes/class-balance.service";
import { ComandaWorkspace } from "./_components/comanda-workspace";

/** PDV-02/PDV-03/PDV-06: tela de lançamento de itens numa comanda aberta. */
export default async function ComandaPage({
  params,
}: {
  params: Promise<{ comandaId: string }>;
}) {
  const { comandaId } = await params;
  const { session, ctx } = await requireModule("pdv");

  const [comanda, products, classPackages] = await Promise.all([
    getComandaWithItems(ctx, comandaId),
    listProducts(undefined, ctx),
    getActiveClassPackages(ctx),
  ]);
  if (!comanda) notFound();

  const activeBalances = comanda.globalCustomerId
    ? await getActiveBalancesForCustomer(ctx, comanda.globalCustomerId)
    : [];

  return (
    <main className="flex-1 p-[22px]">
      <ComandaWorkspace
        comanda={comanda}
        products={products}
        classPackages={classPackages}
        activeBalances={activeBalances}
        userRole={session.role}
      />
    </main>
  );
}
