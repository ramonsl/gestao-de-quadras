import { requireSession, arenaContext } from "@/lib/session";
import { getCourtsByTenant } from "@gestao-de-quadras/core/courts/court.service";
import { createTimeSlotAction } from "../_actions/create-time-slot.action";
import { redirect } from "next/navigation";
import Link from "next/link";

const labelCls = "block text-xs font-semibold text-[var(--text-2)] mb-1.5";
const inputCls =
  "w-full h-9 px-3 text-sm text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-input)] outline-none transition-[border-color] duration-[180ms] placeholder:text-[var(--text-3)] focus:border-[var(--accent)]";

const DAYS_OF_WEEK = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
];

export default async function NovaFaixaHorariaPage() {
  const session = await requireSession();
  const ctx = arenaContext({ id: session.userId, tenantId: session.tenantId });
  const courts = await getCourtsByTenant(ctx);

  async function handleCreate(formData: FormData) {
    "use server";
    const res = await createTimeSlotAction(formData);
    if (res?.success) {
      redirect("/admin/faixas-horarias");
    }
  }

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center bg-white border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-1)]">Nova Faixa Horária</h1>
      </header>

      <main className="flex-1 min-h-0 overflow-auto p-[22px]">
        <form
          action={handleCreate}
          className="max-w-2xl bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-6 space-y-5"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="courtId" className={labelCls}>
                Quadra *
              </label>

              {courts.length === 0 ? (
                <p className="text-xs text-[var(--danger)]">
                  Nenhuma quadra cadastrada. Cadastre uma quadra primeiro.
                </p>
              ) : (
                <select id="courtId" name="courtId" className={inputCls} required defaultValue={courts[0]?.id}>
                  {courts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.modality})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label htmlFor="dayOfWeek" className={labelCls}>
                Dia da Semana *
              </label>
              <select id="dayOfWeek" name="dayOfWeek" className={inputCls} required defaultValue={1}>
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="startTimeHHMM" className={labelCls}>
                Início (HH:MM) *
              </label>
              <input
                type="text"
                id="startTimeHHMM"
                name="startTimeHHMM"
                placeholder="08:00"
                pattern="^([0-1][0-9]|2[0-3]):[0-5][0-9]$"
                className={inputCls}
                required
              />
            </div>

            <div>
              <label htmlFor="endTimeHHMM" className={labelCls}>
                Fim (HH:MM) *
              </label>
              <input
                type="text"
                id="endTimeHHMM"
                name="endTimeHHMM"
                placeholder="09:00"
                pattern="^([0-1][0-9]|2[0-3]):[0-5][0-9]$"
                className={inputCls}
                required
              />
            </div>

            <div>
              <label htmlFor="durationMinutes" className={labelCls}>
                Duração (minutos) *
              </label>
              <input
                type="number"
                id="durationMinutes"
                name="durationMinutes"
                placeholder="60"
                defaultValue={60}
                min="15"
                className={inputCls}
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="priceInCents" className={labelCls}>
              Valor da Faixa Horária (R$) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              id="priceInCents"
              name="priceInCents"
              placeholder="120,00"
              className={inputCls}
              required
            />
          </div>

          <div className="flex items-center gap-3 pt-3">
            <button
              type="submit"
              disabled={courts.length === 0}
              className="h-9 px-4 text-sm font-semibold text-white rounded-[var(--radius-button)] transition-colors duration-[180ms] disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)" }}
            >
              Salvar faixa horária
            </button>
            <Link href="/admin/faixas-horarias" className="text-sm text-[var(--text-3)] hover:text-[var(--text-2)]">
              Cancelar
            </Link>
          </div>
        </form>
      </main>
    </>
  );
}
