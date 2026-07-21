import { requireAdmin } from "@/lib/session";
import { getWhatsAppConnectionStatus } from "@gestao-de-quadras/core/whatsapp/whatsapp-connection.service";
import { WhatsAppConnectionPanel } from "./_components/whatsapp-connection-panel";

export const dynamic = "force-dynamic";

export default async function WhatsAppPage() {
  const { ctx } = await requireAdmin();
  const status = await getWhatsAppConnectionStatus(ctx);

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center justify-between bg-white border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-1)]">WhatsApp</h1>
      </header>

      <main className="flex-1 min-h-0 overflow-auto p-[22px]">
        <p className="mb-3 text-[11px] text-[var(--text-3)]">
          Mensagens automáticas aos clientes usam este número. Desconectar interrompe o envio até
          uma nova leitura do QR Code.
        </p>
        <WhatsAppConnectionPanel
          initialSnapshot={{
            status: status.status,
            qrCode: status.qrCode,
            phoneNumber: status.phoneNumber,
            reconnectAttempts: status.reconnectAttempts,
            updatedAt: status.updatedAt.toISOString(),
          }}
        />
      </main>
    </>
  );
}
