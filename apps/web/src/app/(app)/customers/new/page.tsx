import { requireSession } from "@/lib/session";
import { createCustomerAction } from "../_actions/create-customer.action";
import { WhatsappInput } from "@/components/ui/whatsapp-input";
import Link from "next/link";

const labelCls = "block text-xs font-semibold text-[var(--text-2)] mb-1.5";
const inputCls =
  "w-full h-9 px-3 text-sm text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-input)] outline-none transition-[border-color] duration-[180ms] placeholder:text-[var(--text-3)] focus:border-[var(--accent)]";

export default async function NewCustomerPage() {
  await requireSession();

  async function handleCreate(formData: FormData) {
    "use server";
    await createCustomerAction(formData);
  }

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center bg-white border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-1)]">Novo cliente</h1>
      </header>

      <main className="flex-1 min-h-0 overflow-auto p-[22px]">
        <form
          action={handleCreate}
          className="max-w-2xl bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-6 space-y-5"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="whatsapp" className={labelCls}>
                WhatsApp *
              </label>
              <WhatsappInput id="whatsapp" name="whatsapp" required />
            </div>

            <div>
              <label htmlFor="name" className={labelCls}>
                Nome completo *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                placeholder="Ex.: Carlos Padel"
                className={inputCls}
                required
              />
            </div>

            <div>
              <label htmlFor="email" className={labelCls}>
                E-mail (opcional)
              </label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="carlos@email.com"
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="birthDate" className={labelCls}>
                Data de nascimento (opcional)
              </label>
              <input
                type="date"
                id="birthDate"
                name="birthDate"
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="optInLgpd"
              name="optInLgpd"
              defaultChecked
              className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
            />
            <label htmlFor="optInLgpd" className="text-xs text-[var(--text-2)] font-medium">
              Consentimento para envio de notificações via WhatsApp (LGPD)
            </label>
          </div>

          <div className="flex items-center gap-3 pt-3">
            <button
              type="submit"
              className="h-9 px-4 text-sm font-semibold text-white rounded-[var(--radius-button)] transition-colors duration-[180ms]"
              style={{ backgroundColor: "var(--accent)" }}
            >
              Salvar cliente
            </button>
            <Link href="/customers" className="text-sm text-[var(--text-3)] hover:text-[var(--text-2)]">
              Cancelar
            </Link>
          </div>
        </form>
      </main>
    </>
  );
}
