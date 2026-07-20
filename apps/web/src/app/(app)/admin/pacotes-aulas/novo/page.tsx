import { requireSession } from "@/lib/session";
import { createPackageAction } from "../_actions/create-package.action";
import Link from "next/link";

const labelCls = "block text-xs font-semibold text-[var(--text-2)] mb-1.5";
const inputCls =
  "w-full h-9 px-3 text-sm text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-input)] outline-none transition-[border-color] duration-[180ms] placeholder:text-[var(--text-3)] focus:border-[var(--accent)]";

export default async function NovoPacoteAulaPage() {
  await requireSession();

  async function handleCreate(formData: FormData) {
    "use server";
    await createPackageAction(formData);
  }

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center bg-white border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-1)]">Novo pacote de aulas</h1>
      </header>

      <main className="flex-1 min-h-0 overflow-auto p-[22px]">
        <form
          action={handleCreate}
          className="max-w-2xl bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-6 space-y-5"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className={labelCls}>
                Nome do pacote *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                placeholder="Ex.: Pacote Mensal 8 Aulas"
                className={inputCls}
                required
              />
            </div>

            <div>
              <label htmlFor="totalClassCount" className={labelCls}>
                Quantidade de aulas *
              </label>
              <input
                type="number"
                id="totalClassCount"
                name="totalClassCount"
                placeholder="Ex.: 8"
                className={inputCls}
                min="1"
                required
              />
            </div>

            <div>
              <label htmlFor="priceInCents" className={labelCls}>
                Preço total (R$) *
              </label>
              <input
                type="number"
                id="priceInCents"
                name="priceInCents"
                placeholder="320.00"
                step="0.01"
                className={inputCls}
                min="0"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-3">
            <button
              type="submit"
              className="h-9 px-4 text-sm font-semibold text-white rounded-[var(--radius-button)] transition-colors duration-[180ms]"
              style={{ backgroundColor: "var(--accent)" }}
            >
              Salvar pacote
            </button>
            <Link href="/admin/pacotes-aulas" className="text-sm text-[var(--text-3)] hover:text-[var(--text-2)]">
              Cancelar
            </Link>
          </div>
        </form>
      </main>
    </>
  );
}
