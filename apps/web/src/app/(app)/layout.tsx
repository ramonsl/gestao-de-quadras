import { requireSession, arenaContext } from "@/lib/session";
import { getWhatsAppConnectionStatus } from "@gestao-de-quadras/core/whatsapp/whatsapp-connection.service";
import { AppSidebar } from "@/components/layout/app-sidebar";

export const dynamic = "force-dynamic";

/**
 * Shell autenticado único (SAAS-12 + Épico Cadastros): sidebar navy + área de conteúdo.
 * Exibe dinamicamente os módulos habilitados para o operador/admin logado.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const isAdmin = session.role === "admin";

  const whatsappStatus = await getWhatsAppConnectionStatus(
    arenaContext({ id: session.userId, tenantId: session.tenantId })
  );

  return (
    <div className="min-h-dvh flex bg-[var(--bg-app)]">
      <AppSidebar
        session={{
          username: session.username,
          role: session.role,
          tenantSlug: session.tenantSlug,
          modulesAllowed: session.modulesAllowed ?? [],
          isAdmin,
        }}
        initialWhatsAppStatus={whatsappStatus.status}
      />

      <div className="flex-1 min-w-0 flex flex-col">{children}</div>
    </div>
  );
}
