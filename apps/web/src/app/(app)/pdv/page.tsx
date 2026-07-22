import Link from "next/link";
import { requireModule } from "@/lib/session";
import { listOpenComandas, getCurrentOpenCashSession } from "@gestao-de-quadras/core/pdv";
import { formatCentsToBRL } from "@/lib/currency";
import { ElapsedTime } from "./_components/elapsed-time";
import { NovaComandaFab } from "./_components/nova-comanda-fab";
import { CashSessionBar } from "./_components/cash-session-bar";

export const dynamic = "force-dynamic";

/**
 * PDV-04 / PDV-01: Grade visual de comandas em aberto + Abertura e Fechamento de Caixa.
 */
export default async function PdvPage() {
  const { ctx } = await requireModule("pdv");
  const [openComandas, currentCashSession] = await Promise.all([
    listOpenComandas(ctx),
    getCurrentOpenCashSession(ctx),
  ]);

  return (
    <main className="flex-1 p-5 md:p-6 space-y-6 max-w-7xl mx-auto w-full relative min-h-[calc(100vh-4rem)]">
      {/* Barra de Status do Caixa */}
      <CashSessionBar initialSession={currentCashSession} />

      <section className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-1)]">Comandas em Aberto</h1>
            <p className="text-xs text-[var(--text-3)]">
              Gerencie os consumos ativos na arena
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--bg-sunken)] text-[var(--text-2)] border border-[var(--border)]">
            {openComandas.length === 0
              ? "Nenhuma comanda"
              : `${openComandas.length} em aberto`}
          </span>
        </div>

        {openComandas.length === 0 ? (
          <div className="text-center py-16 px-4 border-2 border-dashed border-[var(--border)] rounded-[var(--radius-card)] bg-white/50">
            <p className="text-base font-medium text-[var(--text-2)]">Nenhuma comanda aberta no momento.</p>
            <p className="text-xs text-[var(--text-3)] mt-1">
              Clique no botão "+" no canto inferior direito para abrir uma nova comanda.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
            {openComandas.map((comanda) => (
              <Link
                key={comanda.id}
                href={`/pdv/${comanda.id}`}
                className="group flex flex-col justify-between p-4 bg-white border border-[var(--border)] rounded-[var(--radius-card)] hover:border-[var(--accent)] hover:shadow-md transition-all duration-200"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-[var(--text-1)] group-hover:text-[var(--accent)] transition-colors truncate">
                      {comanda.customerName ?? "Venda Balcão"}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-[var(--text-3)]">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-3.5 h-3.5 shrink-0"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <ElapsedTime fromISO={new Date(comanda.openedAt).toISOString()} />
                  </div>
                </div>

                <div className="mt-4 pt-2.5 border-t border-[var(--border)] flex items-center justify-between">
                  <span className="text-xs text-[var(--text-3)]">
                    {comanda.itemCount === 1 ? "1 item" : `${comanda.itemCount} itens`}
                  </span>
                  <span className="text-base font-bold text-[var(--text-1)]">
                    {formatCentsToBRL(comanda.totalCents)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <NovaComandaFab />
    </main>
  );
}
