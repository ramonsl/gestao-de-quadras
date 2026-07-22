import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession, arenaContext } from "@/lib/session";
import { listAdSpaces } from "@gestao-de-quadras/core/publicidade/ad-space.service";
import { AD_SPACE_TYPE_LABELS, AD_SPACE_STATUS_LABELS } from "./_components/ad-space-form";

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_TOKEN: Record<string, string> = {
  disponivel: "var(--success)",
  ocupado: "var(--accent)",
  manutencao: "var(--warning)",
};

export default async function EspacosPublicitariosPage() {
  const session = await requireSession();
  if (!["admin", "gerente"].includes(session.role)) redirect("/negado");
  const ctx = arenaContext({ id: session.userId, tenantId: session.tenantId });
  const spaces = await listAdSpaces(ctx);

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center justify-between bg-white border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-1)]">Espaços Publicitários</h1>
        <Link
          href="/admin/publicidade/espacos/novo"
          className="inline-flex items-center h-9 px-4 text-sm font-semibold text-white rounded-[var(--radius-button)]"
          style={{ backgroundColor: "var(--accent)" }}
        >
          Novo espaço
        </Link>
      </header>

      <main className="flex-1 min-h-0 overflow-auto p-[22px] space-y-4">
        <p className="text-[11px] text-[var(--text-3)]">
          Pontos de publicidade da arena (placas, lonas, banners) e seu valor de referência (PUB-01).
        </p>

        {spaces.length === 0 ? (
          <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-8 text-center text-sm text-[var(--text-3)]">
            Nenhum espaço publicitário cadastrado.
          </div>
        ) : (
          <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-3)]">
                  <th className="text-left font-medium px-4 py-2">Identificação</th>
                  <th className="text-left font-medium px-4 py-2">Tipo</th>
                  <th className="text-left font-medium px-4 py-2">Status</th>
                  <th className="text-right font-medium px-4 py-2">Valor de referência</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {spaces.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--border-soft)] last:border-0">
                    <td className="px-4 py-2 text-[var(--text-1)]">{s.name}</td>
                    <td className="px-4 py-2">{AD_SPACE_TYPE_LABELS[s.spaceType] ?? s.spaceType}</td>
                    <td className="px-4 py-2">
                      <span
                        className="inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: STATUS_TOKEN[s.status] ?? "var(--text-3)" }}
                      >
                        {AD_SPACE_STATUS_LABELS[s.status] ?? s.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatBRL(s.referencePriceCents)}</td>
                    <td className="px-4 py-2 text-right">
                      <Link href={`/admin/publicidade/espacos/${s.id}/editar`} className="text-[var(--accent)] hover:underline">
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
