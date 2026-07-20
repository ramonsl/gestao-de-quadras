import { requireSession, arenaContext } from "@/lib/session";
import { getCourtsByTenant } from "@gestao-de-quadras/core/courts/court.service";
import Link from "next/link";

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-[var(--radius-pill)] text-[11px] font-semibold"
      style={{
        backgroundColor: active ? "var(--accent-tint)" : "var(--border-soft)",
        color: active ? "var(--accent-hover)" : "var(--text-3)",
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: active ? "var(--success)" : "var(--text-3)" }}
      />
      {active ? "Ativa" : "Inativa"}
    </span>
  );
}

export default async function QuadrasPage() {
  const session = await requireSession();
  const ctx = arenaContext({ id: session.userId, tenantId: session.tenantId });
  const courts = await getCourtsByTenant(ctx);

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center justify-between bg-white border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-1)]">Quadras</h1>
        <Link
          href="/admin/quadras/nova"
          className="inline-flex items-center h-9 px-4 text-sm font-semibold text-white rounded-[var(--radius-button)] transition-colors duration-[180ms]"
          style={{ backgroundColor: "var(--accent)" }}
        >
          Nova quadra
        </Link>
      </header>

      <main className="flex-1 min-h-0 overflow-auto p-[22px]">
        <p className="mb-3 text-[11px] text-[var(--text-3)]">
          Quadras de padel e beach tennis cadastradas para agendamento e locação (CAD-04).
        </p>

        {courts.length === 0 ? (
          <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-8 text-center text-sm text-[var(--text-3)]">
            Nenhuma quadra cadastrada ainda.
          </div>
        ) : (
          <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-overline text-[var(--text-3)] border-b border-[var(--border)]">
                  <th className="px-4 py-3">QUADRA</th>
                  <th className="px-4 py-3">MODALIDADE</th>
                  <th className="px-4 py-3">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {courts.map((court) => (
                  <tr key={court.id} className="border-b border-[var(--border-soft)] last:border-0 hover:bg-[var(--bg-sunken)] transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--text-1)]">{court.name}</td>
                    <td className="px-4 py-3 text-[var(--text-2)] uppercase text-[11px] font-semibold">{court.modality}</td>
                    <td className="px-4 py-3">
                      <StatusPill active={court.isActive} />
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
