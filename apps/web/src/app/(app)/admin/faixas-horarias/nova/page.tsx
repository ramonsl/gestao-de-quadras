import { requireSession, arenaContext } from "@/lib/session";
import { getCourtsByTenant } from "@gestao-de-quadras/core/courts/court.service";
import { ScheduleRuleForm } from "../_components/schedule-rule-form";

export const metadata = {
  title: "Configurar Grade de Horários | Gestão de Quadras",
  description:
    "Configure o horário de funcionamento e o preço por bloco de 30 minutos para cada quadra.",
};

export default async function NovaFaixaHorariaPage() {
  const session = await requireSession();
  const ctx = arenaContext({ id: session.userId, tenantId: session.tenantId });
  const courts = await getCourtsByTenant(ctx);

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center gap-3 bg-white border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-1)]">
          Configurar Grade de Horários
        </h1>
        <span className="text-xs text-[var(--text-3)] bg-[var(--bg-sunken)] px-2 py-0.5 rounded-full border border-[var(--border)]">
          CAD-05
        </span>
        <div className="ml-4 text-xs text-[var(--text-3)]">
          Defina abertura/fechamento · slots de{" "}
          <strong className="text-[var(--text-2)]">30 minutos</strong> gerados automaticamente
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-auto p-[22px]">
        <ScheduleRuleForm courts={courts} />
      </main>
    </>
  );
}
