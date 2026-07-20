import { requireSession, arenaContext } from "@/lib/session";
import { getCourtsByTenant } from "@gestao-de-quadras/core/courts/court.service";
import { getTimeSlots } from "@gestao-de-quadras/core/courts/court-time-slot.service";
import type { CourtTimeSlot } from "@gestao-de-quadras/db/schema";
import Link from "next/link";

const DAYS_OF_WEEK = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export default async function FaixasHorariasPage() {
  const session = await requireSession();
  const ctx = arenaContext({ id: session.userId, tenantId: session.tenantId });

  const courts = await getCourtsByTenant(ctx);

  const slotsMap = new Map<string, CourtTimeSlot[]>();
  for (const court of courts) {
    const slots = await getTimeSlots(ctx, court.id);
    slotsMap.set(court.id, slots);
  }

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center justify-between bg-white border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-1)]">Faixas Horárias</h1>
        <Link
          href="/admin/faixas-horarias/nova"
          className="inline-flex items-center h-9 px-4 text-sm font-semibold text-white rounded-[var(--radius-button)] transition-colors duration-[180ms]"
          style={{ backgroundColor: "var(--accent)" }}
        >
          Nova faixa
        </Link>
      </header>

      <main className="flex-1 min-h-0 overflow-auto p-[22px] space-y-4">
        <p className="text-[11px] text-[var(--text-3)]">
          Grade de faixas horárias e preços diferenciados por dia da semana (CAD-05).
        </p>

        {courts.length === 0 ? (
          <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-8 text-center text-sm text-[var(--text-3)]">
            Cadastre quadras primeiro para definir faixas horárias.
          </div>
        ) : (
          <div className="space-y-4">
            {courts.map((court) => {
              const slots = slotsMap.get(court.id) || [];
              const slotsByDay = new Map<number, CourtTimeSlot[]>();

              slots.forEach((slot) => {
                const arr = slotsByDay.get(slot.dayOfWeek) ?? [];
                arr.push(slot);
                slotsByDay.set(slot.dayOfWeek, arr);
              });

              return (
                <div
                  key={court.id}
                  className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] overflow-hidden"
                >
                  <div className="px-4 py-3 bg-[var(--bg-sunken)] border-b border-[var(--border)] font-medium text-sm text-[var(--text-1)] flex items-center justify-between">
                    <span>{court.name}</span>
                    <span className="text-xs text-[var(--text-3)]">{slots.length} faixa(s) cadastrada(s)</span>
                  </div>

                  {slots.length === 0 ? (
                    <div className="p-4 text-xs text-[var(--text-3)] text-center">
                      Nenhuma faixa horária cadastrada nesta quadra.
                    </div>
                  ) : (
                    <div className="p-4 grid grid-cols-7 gap-2">
                      {DAYS_OF_WEEK.map((day, dayIndex) => {
                        const daySlots = slotsByDay.get(dayIndex) || [];
                        return (
                          <div
                            key={dayIndex}
                            className="border border-[var(--border)] rounded-[var(--radius-control)] p-2.5 bg-white"
                          >
                            <h3 className="text-overline text-[var(--text-3)] mb-2 font-bold">{day}</h3>
                            {daySlots.length === 0 ? (
                              <p className="text-[11px] text-[var(--text-3)]">Sem faixas</p>
                            ) : (
                              <div className="space-y-1.5">
                                {daySlots.map((slot) => (
                                  <div
                                    key={slot.id}
                                    className="p-1.5 rounded bg-[var(--accent-tint-soft)] border border-[var(--accent-tint)] text-[11px]"
                                  >
                                    <div className="font-semibold text-[var(--text-1)]">
                                      {slot.startTimeHHMM} - {slot.endTimeHHMM}
                                    </div>
                                    <div className="font-bold text-[var(--accent-hover)]">
                                      R$ {(slot.priceInCents / 100).toFixed(2).replace(".", ",")}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
