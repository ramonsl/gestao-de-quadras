import { requireModule } from "@/lib/session";
import { getCourtGridForDate } from "@gestao-de-quadras/core/courts/court-booking.service";
import { listOpenComandas } from "@gestao-de-quadras/core/pdv";
import { DateNavigator } from "./_components/date-navigator";
import { CourtGrid } from "./_components/court-grid";

export const dynamic = "force-dynamic";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function todayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default async function CourtGridPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const { ctx } = await requireModule("quadras");

  const today = todayStr();
  // Datas passadas caem para hoje (a grade só opera hoje e futuros — AC1).
  const date = dateParam && DATE_REGEX.test(dateParam) && dateParam >= today ? dateParam : today;

  const [grid, openComandas] = await Promise.all([
    getCourtGridForDate(ctx, { date }),
    listOpenComandas(ctx),
  ]);

  const comandaOptions = openComandas.map((c) => ({
    id: c.id,
    label: c.customerName ?? "Venda Balcão",
    totalCents: c.totalCents,
  }));

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center justify-between bg-white border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-1)]">Grade de Locação</h1>
        <DateNavigator date={date} minDate={today} />
      </header>

      <main className="flex-1 min-h-0 overflow-auto p-[22px]">
        {grid.courts.length === 0 ? (
          <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-8 text-center text-sm text-[var(--text-3)]">
            Nenhuma quadra ativa cadastrada. Cadastre quadras e faixas horárias para usar a grade.
          </div>
        ) : grid.rowStartTimes.length === 0 ? (
          <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-8 text-center text-sm text-[var(--text-3)]">
            Nenhuma faixa horária configurada para este dia da semana.
          </div>
        ) : (
          <CourtGrid grid={grid} date={date} comandaOptions={comandaOptions} />
        )}
      </main>
    </>
  );
}
