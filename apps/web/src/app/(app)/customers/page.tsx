import { requireSession, arenaContext } from "@/lib/session";
import { getCustomersByTenant } from "@gestao-de-quadras/core/customers/customer.service";
import Link from "next/link";

function StatusPill({ status }: { status: string }) {
  const active = status === "active";
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

export default async function CustomersPage() {
  const session = await requireSession();
  const ctx = arenaContext({ id: session.userId, tenantId: session.tenantId });
  const customers = await getCustomersByTenant(ctx);

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center justify-between bg-white border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-1)]">Clientes</h1>
        <Link
          href="/customers/new"
          className="inline-flex items-center h-9 px-4 text-sm font-semibold text-white rounded-[var(--radius-button)] transition-colors duration-[180ms]"
          style={{ backgroundColor: "var(--accent)" }}
        >
          Novo cliente
        </Link>
      </header>

      <main className="flex-1 min-h-0 overflow-auto p-[22px]">
        <p className="mb-3 text-[11px] text-[var(--text-3)]">
          Clientes e atletas da arena. Identidade global vinculada por WhatsApp (CAD-01).
        </p>

        {customers.length === 0 ? (
          <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-8 text-center text-sm text-[var(--text-3)]">
            Nenhum cliente cadastrado ainda.
          </div>
        ) : (
          <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-overline text-[var(--text-3)] border-b border-[var(--border)]">
                  <th className="px-4 py-3">NOME · WHATSAPP</th>
                  <th className="px-4 py-3">E-MAIL</th>
                  <th className="px-4 py-3">DATA DE NASCIMENTO</th>
                  <th className="px-4 py-3">STATUS</th>
                  <th className="px-4 py-3 text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-b border-[var(--border-soft)] last:border-0 hover:bg-[var(--bg-sunken)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--text-1)]">{customer.name}</div>
                      <div className="text-[var(--text-3)]">{customer.whatsapp}</div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-2)]">{customer.email || "—"}</td>
                    <td className="px-4 py-3 text-[var(--text-2)]">{customer.birthDate || "—"}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={customer.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium"
                      >
                        Visualizar
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
