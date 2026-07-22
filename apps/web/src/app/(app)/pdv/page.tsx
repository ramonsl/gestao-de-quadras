import Link from "next/link";
import { requireModule } from "@/lib/session";
import { listOpenComandas } from "@gestao-de-quadras/core/pdv";
import { formatCentsToBRL } from "@/lib/currency";
import { StartComandaPanel } from "./_components/start-comanda-panel";
import { ElapsedTime } from "./_components/elapsed-time";

export const dynamic = "force-dynamic";

/**
 * PDV-02/PDV-03: início de comanda — busca cliente existente, cadastro rápido
 * inline, ou venda balcão/anônima. PDV-04: painel de comandas abertas no topo.
 * Os 3 papéis (admin/gerente/atendente) acessam desde que o módulo "pdv"
 * esteja habilitado.
 */
export default async function PdvPage() {
  const { ctx } = await requireModule("pdv");
  const openComandas = await listOpenComandas(ctx);

  return (
    <main className="flex-1 p-[22px] space-y-8">
      <section className="max-w-2xl mx-auto space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-[var(--text-1)]">Comandas abertas</h2>
          <span className="text-xs text-[var(--text-3)]">
            {openComandas.length === 0
              ? "nenhuma"
              : `${openComandas.length} em aberto`}
          </span>
        </div>

        {openComandas.length === 0 ? (
          <p className="text-sm text-[var(--text-3)] border border-dashed border-[var(--border)] rounded-[var(--radius-card)] px-4 py-6 text-center">
            Nenhuma comanda aberta no momento. Abra uma nova abaixo.
          </p>
        ) : (
          <ul className="space-y-2">
            {openComandas.map((comanda) => (
              <li key={comanda.id}>
                <Link
                  href={`/pdv/${comanda.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 bg-white border border-[var(--border)] rounded-[var(--radius-card)] hover:border-[var(--accent)] transition-colors"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-1)] truncate">
                      {comanda.customerName ?? "Venda Balcão"}
                    </p>
                    <p className="text-xs text-[var(--text-3)]">
                      <ElapsedTime fromISO={new Date(comanda.openedAt).toISOString()} />
                      {" · "}
                      {comanda.itemCount === 1 ? "1 item" : `${comanda.itemCount} itens`}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-[var(--text-1)] shrink-0">
                    {formatCentsToBRL(comanda.totalCents)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <StartComandaPanel />
    </main>
  );
}
