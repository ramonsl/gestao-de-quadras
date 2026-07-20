import Link from "next/link";
import { requireSession } from "@/lib/session";

/**
 * Shell autenticado mínimo (SAAS-12): sidebar navy + área de conteúdo.
 * A navegação por módulo completa virá com as US de cada módulo; aqui expomos
 * apenas o que já existe.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const isAdmin = session.role === "admin";

  return (
    <div className="min-h-dvh flex bg-[var(--bg-app)]">
      <aside
        className="w-[216px] shrink-0 flex flex-col text-white"
        style={{ backgroundColor: "var(--sidebar-bg)" }}
      >
        <div className="px-4 h-14 flex items-center gap-2.5 border-b border-white/10">
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-[8px] font-bold text-sm"
            style={{ backgroundColor: "var(--accent-bright)" }}
          >
            A
          </span>
          <span className="text-sm font-semibold truncate">{session.tenantSlug}</span>
        </div>

        <nav className="flex-1 px-2 py-3">
          {isAdmin && (
            <>
              <p className="px-2 pt-2 pb-1 text-[10px] font-bold tracking-[0.08em] text-white/40">
                CONFIGURAÇÃO
              </p>
              <Link
                href="/usuarios"
                className="flex items-center gap-2 px-2.5 h-9 rounded-[var(--radius-control)] text-sm text-white/90 transition-colors duration-[180ms] hover:bg-[var(--sidebar-hover)]"
              >
                <span className="w-4 h-4 rounded-[4px] bg-white/25" />
                Usuários
              </Link>
            </>
          )}
        </nav>

        <div className="px-4 py-3 border-t border-white/10 text-xs text-white/60">
          <p className="truncate">{session.username}</p>
          <p className="uppercase tracking-wide text-[10px] text-white/40">{session.role}</p>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">{children}</div>
    </div>
  );
}
