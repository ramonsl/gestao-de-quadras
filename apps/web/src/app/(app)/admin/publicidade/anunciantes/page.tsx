import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession, arenaContext } from "@/lib/session";
import { listAdvertisers } from "@gestao-de-quadras/core/publicidade/advertiser.service";

/** Formata CPF (11) ou CNPJ (14) a partir dos dígitos armazenados. */
function formatDocument(doc: string): string {
  if (doc.length === 11) return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (doc.length === 14) return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc;
}

export default async function AnunciantesPage() {
  const session = await requireSession();
  if (!["admin", "gerente"].includes(session.role)) redirect("/negado");
  const ctx = arenaContext({ id: session.userId, tenantId: session.tenantId });
  const advertisers = await listAdvertisers(ctx);

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center justify-between bg-white border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-1)]">Anunciantes</h1>
        <Link
          href="/admin/publicidade/anunciantes/novo"
          className="inline-flex items-center h-9 px-4 text-sm font-semibold text-white rounded-[var(--radius-button)]"
          style={{ backgroundColor: "var(--accent)" }}
        >
          Novo anunciante
        </Link>
      </header>

      <main className="flex-1 min-h-0 overflow-auto p-[22px] space-y-4">
        <p className="text-[11px] text-[var(--text-3)]">
          Empresas parceiras que locam espaços publicitários da arena (PUB-01).
        </p>

        {advertisers.length === 0 ? (
          <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-8 text-center text-sm text-[var(--text-3)]">
            Nenhum anunciante cadastrado.
          </div>
        ) : (
          <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-3)]">
                  <th className="text-left font-medium px-4 py-2">Razão social / Nome</th>
                  <th className="text-left font-medium px-4 py-2">CNPJ / CPF</th>
                  <th className="text-left font-medium px-4 py-2">E-mail</th>
                  <th className="text-left font-medium px-4 py-2">Telefone</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {advertisers.map((a) => (
                  <tr key={a.id} className="border-b border-[var(--border-soft)] last:border-0">
                    <td className="px-4 py-2 text-[var(--text-1)]">{a.name}</td>
                    <td className="px-4 py-2 tabular-nums">{formatDocument(a.document)}</td>
                    <td className="px-4 py-2">{a.email ?? "—"}</td>
                    <td className="px-4 py-2">{a.phone ?? "—"}</td>
                    <td className="px-4 py-2 text-right">
                      <Link href={`/admin/publicidade/anunciantes/${a.id}/editar`} className="text-[var(--accent)] hover:underline">
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
