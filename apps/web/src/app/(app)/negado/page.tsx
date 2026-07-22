import Link from "next/link";
import { requireSession } from "@/lib/session";

/** Exibida quando o operador não tem o módulo necessário habilitado (regra 3, `requireModule`). */
export default async function AcessoNegadoPage() {
  await requireSession();
  return (
    <main className="flex-1 flex items-center justify-center p-[22px]">
      <div
        className="max-w-sm w-full bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-6 text-center"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <h1 className="text-base font-semibold text-[var(--text-1)] mb-2">Acesso restrito</h1>
        <p className="text-sm text-[var(--text-2)] mb-4">
          Este módulo não está habilitado para o seu usuário. Fale com o Admin da arena para liberar o acesso.
        </p>
        <Link href="/" className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)]">
          Voltar
        </Link>
      </div>
    </main>
  );
}
