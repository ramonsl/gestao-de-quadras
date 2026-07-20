import Link from "next/link";
import { requireSession } from "@/lib/session";

/** Exibida quando um operador sem perfil Admin tenta acessar a gestão de usuários. */
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
          A gestão de usuários é exclusiva do perfil Admin desta arena.
        </p>
        <Link
          href="/usuarios"
          className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)]"
        >
          Voltar
        </Link>
      </div>
    </main>
  );
}
