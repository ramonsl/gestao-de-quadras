import type {
  MessagingProvider,
  MessagingProviderEvent,
  MessagingProviderEventHandler,
  MessagingTenantRef,
  SendMessageInput,
  SendMessageResult,
} from "../provider";
import type { WhatsAppConnectionSnapshot } from "../types";
import type { ArenaDb } from "../db-types";
import { WhatsAppSessionPool, type SocketFactory } from "./session-pool";

/**
 * Implementação concreta de `MessagingProvider` sobre o pool de sessões
 * Baileys. Único ponto do produto que sabe que "mensageria" hoje é Baileys.
 */
export class BaileysMessagingProvider implements MessagingProvider {
  private readonly pool: WhatsAppSessionPool;

  constructor(
    private readonly db: ArenaDb,
    socketFactory?: SocketFactory
  ) {
    this.pool = new WhatsAppSessionPool(socketFactory);
  }

  /** Retoma, no boot do worker, as sessões que estavam ativas antes do restart/deploy. */
  async bootstrap(tenantIds: string[]): Promise<void> {
    await this.pool.bootstrap(tenantIds.map((tenantId) => ({ db: this.db, tenantId })));
  }

  async startConnection(ref: MessagingTenantRef): Promise<void> {
    await this.pool.connect({ db: this.db, tenantId: ref.tenantId });
  }

  async disconnectConnection(ref: MessagingTenantRef): Promise<void> {
    await this.pool.disconnect({ db: this.db, tenantId: ref.tenantId });
  }

  async getConnectionStatus(ref: MessagingTenantRef): Promise<WhatsAppConnectionSnapshot> {
    return this.pool.getStatus({ db: this.db, tenantId: ref.tenantId });
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const session = this.pool.getSession(input.tenantId);
    if (!session) return { success: false, reason: "not_connected" };
    const jid = input.toE164.replace("+", "") + "@s.whatsapp.net";
    try {
      const result = await session.socket.sendMessage(jid, { text: input.text });
      return { success: true, providerMessageId: result?.key?.id ?? undefined };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return { success: false, reason };
    }
  }

  onEvent(handler: MessagingProviderEventHandler): () => void {
    return this.pool.onEvent((event) => {
      handler({ type: "statusChange", tenantId: event.tenantId, snapshot: event.snapshot });
      if (event.permanentDisconnect) {
        handler({ type: "permanentDisconnect", tenantId: event.tenantId });
      }
      if (event.incomingMessage) {
        handler({
          type: "incomingMessage",
          tenantId: event.tenantId,
          fromE164: event.incomingMessage.fromE164,
          text: event.incomingMessage.text,
          baileysMessageId: event.incomingMessage.baileysMessageId,
        });
      }
    });
  }
}
