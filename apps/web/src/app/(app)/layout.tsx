import Link from "next/link";
import { requireSession } from "@/lib/session";

/**
 * Shell autenticado (SAAS-12 + Épico Cadastros): sidebar navy + área de conteúdo.
 * Exibe dinamicamente os módulos habilitados para o operador/admin logado.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const isAdmin = session.role === "admin";
  const modules = session.modulesAllowed ?? [];

  const canAccess = (moduleName: string) => isAdmin || modules.includes(moduleName);

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

        <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
          {/* Módulo de Cadastros / Operações */}
          {canAccess("crm") || canAccess("quadras") || canAccess("pdv") ? (
            <div>
              <p className="px-2 pt-2 pb-1 text-[10px] font-bold tracking-[0.08em] text-white/40">
                CADASTROS & OPERAÇÃO
              </p>

              <div className="space-y-1">
                {canAccess("crm") && (
                  <Link
                    href="/dashboard/customers"
                    className="flex items-center gap-2 px-2.5 h-9 rounded-[var(--radius-control)] text-sm text-white/90 transition-colors duration-[180ms] hover:bg-[var(--sidebar-hover)]"
                  >
                    <span className="w-2 h-2 rounded-full bg-[var(--accent-bright)]" />
                    Clientes
                  </Link>
                )}

                {canAccess("pdv") && (
                  <Link
                    href="/admin/produtos"
                    className="flex items-center gap-2 px-2.5 h-9 rounded-[var(--radius-control)] text-sm text-white/90 transition-colors duration-[180ms] hover:bg-[var(--sidebar-hover)]"
                  >
                    <span className="w-2 h-2 rounded-full bg-[var(--accent-bright)]" />
                    Produtos
                  </Link>
                )}

                {canAccess("quadras") && (
                  <>
                    <Link
                      href="/admin/quadras"
                      className="flex items-center gap-2 px-2.5 h-9 rounded-[var(--radius-control)] text-sm text-white/90 transition-colors duration-[180ms] hover:bg-[var(--sidebar-hover)]"
                    >
                      <span className="w-2 h-2 rounded-full bg-[var(--accent-bright)]" />
                      Quadras
                    </Link>

                    <Link
                      href="/admin/servicos-quadras"
                      className="flex items-center gap-2 px-2.5 h-9 rounded-[var(--radius-control)] text-sm text-white/90 transition-colors duration-[180ms] hover:bg-[var(--sidebar-hover)]"
                    >
                      <span className="w-2 h-2 rounded-full bg-[var(--accent-bright)]" />
                      Serviços de Quadra
                    </Link>

                    <Link
                      href="/admin/faixas-horarias"
                      className="flex items-center gap-2 px-2.5 h-9 rounded-[var(--radius-control)] text-sm text-white/90 transition-colors duration-[180ms] hover:bg-[var(--sidebar-hover)]"
                    >
                      <span className="w-2 h-2 rounded-full bg-[var(--accent-bright)]" />
                      Faixas Horárias
                    </Link>

                    <Link
                      href="/admin/pacotes-aulas"
                      className="flex items-center gap-2 px-2.5 h-9 rounded-[var(--radius-control)] text-sm text-white/90 transition-colors duration-[180ms] hover:bg-[var(--sidebar-hover)]"
                    >
                      <span className="w-2 h-2 rounded-full bg-[var(--accent-bright)]" />
                      Pacotes de Aulas
                    </Link>
                  </>
                )}
              </div>
            </div>
          ) : null}

          {/* Módulo Admin */}
          {isAdmin && (
            <div>
              <p className="px-2 pt-2 pb-1 text-[10px] font-bold tracking-[0.08em] text-white/40">
                CONFIGURAÇÃO
              </p>
              <Link
                href="/usuarios"
                className="flex items-center gap-2 px-2.5 h-9 rounded-[var(--radius-control)] text-sm text-white/90 transition-colors duration-[180ms] hover:bg-[var(--sidebar-hover)]"
              >
                <span className="w-2 h-2 rounded-full bg-white/40" />
                Usuários & Permissões
              </Link>
            </div>
          )}
        </nav>

        <div className="px-4 py-3 border-t border-white/10 text-xs text-white/60">
          <p className="truncate font-medium text-white/90">{session.username}</p>
          <p className="uppercase tracking-wide text-[10px] text-white/40">{session.role}</p>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">{children}</div>
    </div>
  );
}
