import { requireSession, arenaContext } from "@/lib/session";
import { getCourtsByTenant } from "@gestao-de-quadras/core/courts/court.service";
import { createServiceAction } from "../_actions/create-service.action";
import { redirect } from "next/navigation";
import Link from "next/link";

const labelCls = "block text-xs font-semibold text-[var(--text-2)] mb-1.5";
const inputCls =
  "w-full h-9 px-3 text-sm text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-input)] outline-none transition-[border-color] duration-[180ms] placeholder:text-[var(--text-3)] focus:border-[var(--accent)]";

export default async function NovoServicoQuadraPage() {
  const session = await requireSession();
  const ctx = arenaContext({ id: session.userId, tenantId: session.tenantId });
  const courts = await getCourtsByTenant(ctx);

  async function handleCreate(formData: FormData) {
    "use server";
    const res = await createServiceAction(formData);
    if (res?.success) {
      redirect("/admin/servicos-quadras");
    }
  }

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center bg-white border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-1)]">Novo Serviço de Quadra</h1>
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
              <label htmlFor="serviceType" className={labelCls}>
                Tipo de Serviço *
              </label>
              <select id="serviceType" name="serviceType" className={inputCls} required defaultValue="rental">
                <option value="rental">Locação de Quadra</option>
                <option value="single_class">Aula Avulsa</option>
                <option value="package">Pacote de Aulas</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="basePriceInCents" className={labelCls}>
              Tarifa / Preço Base (R$) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              id="basePriceInCents"
              name="basePriceInCents"
              placeholder="100,00"
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
              Salvar serviço
            </button>
            <Link href="/admin/servicos-quadras" className="text-sm text-[var(--text-3)] hover:text-[var(--text-2)]">
              Cancelar
            </Link>
          </div>
        </form>
      </main>
    </>
  );
}
