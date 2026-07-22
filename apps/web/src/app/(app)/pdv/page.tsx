import { requireModule } from "@/lib/session";
import { StartComandaPanel } from "./_components/start-comanda-panel";

/**
 * PDV-02/PDV-03: início de comanda — busca cliente existente, cadastro rápido
 * inline, ou venda balcão/anônima. Os 3 papéis (admin/gerente/atendente)
 * acessam desde que o módulo "pdv" esteja habilitado.
 */
export default async function PdvPage() {
  await requireModule("pdv");

  return (
    <main className="flex-1 p-[22px]">
      <StartComandaPanel />
    </main>
  );
}
