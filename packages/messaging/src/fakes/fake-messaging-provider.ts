import type {
  MessagingProvider,
  MessagingProviderEvent,
  MessagingProviderEventHandler,
  MessagingTenantRef,
  SendMessageInput,
  SendMessageResult,
} from "../provider";
import type { WhatsAppConnectionSnapshot } from "../types";

function emptySnapshot(): WhatsAppConnectionSnapshot {
  return {
    status: "disconnected",
    qrCode: null,
    phoneNumber: null,
    reconnectAttempts: 0,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Implementação em memória de `MessagingProvider` — usada em testes unitários
 * e specs e2e. Nunca usar Baileys real em CI (ver `.claude/skills/whatsapp-msg`).
 */
export class FakeMessagingProvider implements MessagingProvider {
  private readonly snapshots = new Map<string, WhatsAppConnectionSnapshot>();
  private readonly listeners = new Set<MessagingProviderEventHandler>();

  private setStatus(tenantId: string, patch: Partial<WhatsAppConnectionSnapshot>): void {
    const current = this.snapshots.get(tenantId) ?? emptySnapshot();
    const next: WhatsAppConnectionSnapshot = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.snapshots.set(tenantId, next);
    this.emit({ type: "statusChange", tenantId, snapshot: next });
  }

  private emit(event: MessagingProviderEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  async startConnection(ref: MessagingTenantRef): Promise<void> {
    this.setStatus(ref.tenantId, { status: "connecting" });
  }

  async disconnectConnection(ref: MessagingTenantRef): Promise<void> {
    this.setStatus(ref.tenantId, { status: "disconnected", qrCode: null, phoneNumber: null });
  }

  async getConnectionStatus(ref: MessagingTenantRef): Promise<WhatsAppConnectionSnapshot> {
    return this.snapshots.get(ref.tenantId) ?? emptySnapshot();
  }

  async sendMessage(_input: SendMessageInput): Promise<SendMessageResult> {
    return { success: true, providerMessageId: "fake-message-id" };
  }

  onEvent(handler: MessagingProviderEventHandler): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  // --- Controles de teste (simulam eventos do Baileys real) -----------------

  simulateQr(tenantId: string, qrCode = "fake-qr-payload"): void {
    this.setStatus(tenantId, { status: "qr_pending", qrCode });
  }

  simulateConnected(tenantId: string, phoneNumber = "+5511999999999"): void {
    this.setStatus(tenantId, { status: "connected", qrCode: null, phoneNumber, reconnectAttempts: 0 });
  }

  simulateTransientDrop(tenantId: string): void {
    const current = this.snapshots.get(tenantId) ?? emptySnapshot();
    this.setStatus(tenantId, { status: "connecting", reconnectAttempts: current.reconnectAttempts + 1 });
  }

  simulatePermanentLogout(tenantId: string): void {
    this.setStatus(tenantId, { status: "disconnected_permanent", qrCode: null });
    this.emit({ type: "permanentDisconnect", tenantId });
  }
}
