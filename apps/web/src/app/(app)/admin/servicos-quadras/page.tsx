import { requireSession, arenaContext } from "@/lib/session";
import { getCourtsByTenant } from "@gestao-de-quadras/core/courts/court.service";
import { getCourtServices } from "@gestao-de-quadras/core/courts/court-service.service";
import type { CourtService } from "@gestao-de-quadras/db/schema";
import Link from "next/link";

const SERVICE_LABELS: Record<string, string> = {
  rental: "Locação de Quadra",
  single_class: "Aula Avulsa",
  package: "Pacote de Aulas",
};

export default async function ServicosQuadrasPage() {
  const session = await requireSession();
  const ctx = arenaContext({ id: session.userId, tenantId: session.tenantId });

  const courts = await getCourtsByTenant(ctx);

  const servicesMap = new Map<string, CourtService[]>();
  for (const court of courts) {
    const services = await getCourtServices(ctx, court.id);
    servicesMap.set(court.id, services);
  }

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center justify-between bg-white border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-1)]">Serviços de Quadra</h1>
        <Link
          href="/admin/servicos-quadras/novo"
          className="inline-flex items-center h-9 px-4 text-sm font-semibold text-white rounded-[var(--radius-button)] transition-colors duration-[180ms]"
          style={{ backgroundColor: "var(--accent)" }}
        >
          Novo serviço
        </Link>
      </header>

      <main className="flex-1 min-h-0 overflow-auto p-[22px] space-y-4">
        <p className="text-[11px] text-[var(--text-3)]">
          Tipos de serviço e tarifas base configuradas por quadra (CAD-04).
        </p>

        {courts.length === 0 ? (
          <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-8 text-center text-sm text-[var(--text-3)]">
            Cadastre quadras primeiro para adicionar serviços.
          </div>
        ) : (
          <div className="space-y-4">
            {courts.map((court) => {
              const services = servicesMap.get(court.id) || [];
              return (
                <div
                  key={court.id}
                  className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] overflow-hidden"
                >
                  <div className="px-4 py-3 bg-[var(--bg-sunken)] border-b border-[var(--border)] font-medium text-sm text-[var(--text-1)] flex items-center justify-between">
                    <span>{court.name}</span>
                    <span className="text-xs uppercase text-[var(--text-3)]">{court.modality}</span>
                  </div>

                  {services.length === 0 ? (
                    <div className="p-4 text-xs text-[var(--text-3)] text-center">
                      Nenhum serviço cadastrado nesta quadra.
                    </div>
                  ) : (
                    <table className="w-full text-[12.5px]">
                      <thead>
                        <tr className="text-left text-overline text-[var(--text-3)] border-b border-[var(--border)]">
                          <th className="px-4 py-2.5">SERVIÇO</th>
                          <th className="px-4 py-2.5">PREÇO BASE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {services.map((service) => (
                          <tr
                            key={service.id}
                            className="border-b border-[var(--border-soft)] last:border-0 hover:bg-[var(--bg-sunken)] transition-colors"
                          >
                            <td className="px-4 py-3 font-medium text-[var(--text-1)]">
                              {SERVICE_LABELS[service.serviceType] || service.serviceType}
                            </td>
                            <td className="px-4 py-3 font-semibold text-[var(--text-1)]">
                              R$ {(service.basePriceInCents / 100).toFixed(2).replace(".", ",")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
