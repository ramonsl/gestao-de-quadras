import { requireSession, arenaContext } from "@/lib/session";
import { getCourtsByTenant } from "@gestao-de-quadras/core/courts/court.service";
import { getTimeSlots } from "@gestao-de-quadras/core/courts/court-time-slot.service";
import { deleteSlotsByDayAction } from "./_actions/delete-slots-by-day.action";
import type { CourtTimeSlot } from "@gestao-de-quadras/db/schema";
import Link from "next/link";

export const metadata = {
  title: "Faixas Horárias | Gestão de Quadras",
};

const DAYS_LONG = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
const DAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function formatPrice(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export default async function FaixasHorariasPage() {
  const session = await requireSession();
  const ctx = arenaContext({ id: session.userId, tenantId: session.tenantId });

  const courts = await getCourtsByTenant(ctx);

  const slotsMap = new Map<string, CourtTimeSlot[]>();
  for (const court of courts) {
    const slots = await getTimeSlots(ctx, court.id);
    slotsMap.set(court.id, slots);
  }

  const canEdit = ["admin", "gerente"].includes(session.role);

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center justify-between bg-white border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-1)]">Faixas Horárias</h1>
        {canEdit && (
          <Link
            href="/admin/faixas-horarias/nova"
            id="btn-nova-faixa"
            className="inline-flex items-center h-9 px-4 text-sm font-semibold text-white rounded-[var(--radius-button)] transition-colors duration-[180ms]"
            style={{ backgroundColor: "var(--accent)" }}
          >
            + Configurar grade
          </Link>
        )}
      </header>

      <main className="flex-1 min-h-0 overflow-auto p-[22px] space-y-4">
        <p className="text-xs text-[var(--text-3)]">
          Grade de horários com blocos de <strong>30 minutos</strong> e preço por fração (CAD-05).
          Ao configurar, selecione múltiplos dias e o sistema gera todos os blocos automaticamente.
        </p>

        {courts.length === 0 ? (
          <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-8 text-center text-sm text-[var(--text-3)]">
            Cadastre quadras primeiro para definir faixas horárias.
          </div>
        ) : (
          <div className="space-y-4">
            {courts.map((court) => {
              const slots = slotsMap.get(court.id) ?? [];
              const slotsByDay = new Map<number, CourtTimeSlot[]>();
              slots.forEach((slot) => {
                const arr = slotsByDay.get(slot.dayOfWeek) ?? [];
                arr.push(slot);
                slotsByDay.set(slot.dayOfWeek, arr);
              });

              const totalSlots = slots.length;
              const activeDays = slotsByDay.size;

              return (
                <div
                  key={court.id}
                  className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] overflow-hidden"
                >
                  {/* Card header */}
                  <div className="px-4 py-3 bg-[var(--bg-sunken)] border-b border-[var(--border)] flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-sm text-[var(--text-1)]">
                        {court.name}
                      </span>
                      <span className="ml-2 text-xs text-[var(--text-3)]">
                        {court.modality}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {totalSlots > 0 ? (
                        <span className="text-xs text-[var(--text-3)]">
                          {activeDays} dia(s) · {totalSlots} slots
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--text-3)]">Sem horários</span>
                      )}
                      {canEdit && (
                        <Link
                          href="/admin/faixas-horarias/nova"
                          className="text-xs text-[var(--accent)] hover:underline"
                        >
                          Configurar
                        </Link>
                      )}
                    </div>
                  </div>

                  {totalSlots === 0 ? (
                    <div className="p-5 text-xs text-[var(--text-3)] text-center">
                      Nenhuma faixa horária cadastrada.{" "}
                      {canEdit && (
                        <Link
                          href="/admin/faixas-horarias/nova"
                          className="text-[var(--accent)] underline"
                        >
                          Configurar agora
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 grid grid-cols-7 gap-2">
                      {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
                        const daySlots = slotsByDay.get(dayIndex) ?? [];
                        const samplePrice = daySlots[0]?.priceInCents;

                        return (
                          <div
                            key={dayIndex}
                            className="border border-[var(--border)] rounded-[var(--radius-control)] p-2.5 bg-white min-w-0"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <h3 className="text-[11px] font-bold text-[var(--text-3)] uppercase tracking-wide">
                                {DAYS_SHORT[dayIndex]}
                              </h3>
                              {daySlots.length > 0 && canEdit && (
                                <form action={deleteSlotsByDayAction}>
                                  <input type="hidden" name="courtId" value={court.id} />
                                  <input type="hidden" name="dayOfWeek" value={dayIndex} />
                                  <button
                                    type="submit"
                                    title={`Remover slots de ${DAYS_LONG[dayIndex]} de ${court.name}`}
                                    className="text-[10px] text-[var(--text-3)] hover:text-[var(--danger)] transition-colors duration-[150ms]"
                                  >
                                    ×
                                  </button>
                                </form>
                              )}
                            </div>

                            {daySlots.length === 0 ? (
                              <p className="text-[10px] text-[var(--text-3)] italic">
                                Sem faixas
                              </p>
                            ) : (
                              <div className="space-y-0.5">
                                {/* Resumo compacto: mostra 1º e último horário */}
                                <div className="text-[10px] font-semibold text-[var(--text-1)]">
                                  {daySlots[0].startTimeHHMM}
                                </div>
                                <div className="text-[10px] text-[var(--text-3)]">
                                  até {daySlots[daySlots.length - 1].endTimeHHMM}
                                </div>
                                {samplePrice !== undefined && (
                                  <div className="mt-1 text-[10px] font-bold text-[var(--accent-hover)]">
                                    {formatPrice(samplePrice)}/30min
                                  </div>
                                )}
                                <div className="text-[9px] text-[var(--text-3)]">
                                  {daySlots.length} bloco(s)
                                </div>
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
