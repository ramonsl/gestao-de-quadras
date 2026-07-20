import { requireSession, arenaContext } from "@/lib/session";
import { getClassPackages } from "@gestao-de-quadras/core/classes/class-package.service";
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
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

export default async function PacotesAulasPage() {
  const session = await requireSession();
  const ctx = arenaContext({ id: session.userId, tenantId: session.tenantId });
  const packages = await getClassPackages(ctx);

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center justify-between bg-white border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-1)]">Pacotes de Aulas</h1>
        <Link
          href="/admin/pacotes-aulas/novo"
          className="inline-flex items-center h-9 px-4 text-sm font-semibold text-white rounded-[var(--radius-button)] transition-colors duration-[180ms]"
          style={{ backgroundColor: "var(--accent)" }}
        >
          Novo pacote
        </Link>
      </header>

      <main className="flex-1 min-h-0 overflow-auto p-[22px]">
        <p className="mb-3 text-[11px] text-[var(--text-3)]">
          Pacotes de créditos para turmas e aulas avulsas de padel/beach tennis (CAD-03).
        </p>

        {packages.length === 0 ? (
          <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-8 text-center text-sm text-[var(--text-3)]">
            Nenhum pacote de aula cadastrado ainda.
          </div>
        ) : (
          <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-overline text-[var(--text-3)] border-b border-[var(--border)]">
                  <th className="px-4 py-3">PACOTE</th>
                  <th className="px-4 py-3">QTD AULAS</th>
                  <th className="px-4 py-3">PREÇO DO PACOTE</th>
                  <th className="px-4 py-3">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr key={pkg.id} className="border-b border-[var(--border-soft)] last:border-0 hover:bg-[var(--bg-sunken)] transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--text-1)]">{pkg.name}</td>
                    <td className="px-4 py-3 text-[var(--text-2)] font-semibold">{pkg.totalClassCount} aula(s)</td>
                    <td className="px-4 py-3 font-semibold text-[var(--text-1)]">
                      R$ {(pkg.priceInCents / 100).toFixed(2).replace(".", ",")}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill active={pkg.isActive} />
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
