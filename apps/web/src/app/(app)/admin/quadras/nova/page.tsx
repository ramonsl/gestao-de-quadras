import { requireSession } from "@/lib/session";
import { createCourtAction } from "../_actions/create-court.action";
import Link from "next/link";

const labelCls = "block text-xs font-semibold text-[var(--text-2)] mb-1.5";
const inputCls =
  "w-full h-9 px-3 text-sm text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-input)] outline-none transition-[border-color] duration-[180ms] placeholder:text-[var(--text-3)] focus:border-[var(--accent)]";

export default async function NovaQuadraPage() {
  await requireSession();

  async function handleCreate(formData: FormData) {
    "use server";
    await createCourtAction(formData);
  }

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center bg-white border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-1)]">Nova quadra</h1>
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
                Nome da quadra *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                placeholder="Ex.: Quadra 01 - Panorâmica"
                className={inputCls}
                required
              />
            </div>

            <div>
              <label htmlFor="modality" className={labelCls}>
                Modalidade *
              </label>
              <select id="modality" name="modality" className={inputCls} required defaultValue="Padel">
                <option value="Padel">Padel</option>
                <option value="Beach Tennis">Beach Tennis</option>
                <option value="Tênis">Tênis</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-3">
            <button
              type="submit"
              className="h-9 px-4 text-sm font-semibold text-white rounded-[var(--radius-button)] transition-colors duration-[180ms]"
              style={{ backgroundColor: "var(--accent)" }}
            >
              Salvar quadra
            </button>
            <Link href="/admin/quadras" className="text-sm text-[var(--text-3)] hover:text-[var(--text-2)]">
              Cancelar
            </Link>
          </div>
        </form>
      </main>
    </>
  );
}
