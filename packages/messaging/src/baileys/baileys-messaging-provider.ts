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

  /** Reservado para WPP-02/04 — envio de mensagens fora do escopo da WPP-01. */
  async sendMessage(_input: SendMessageInput): Promise<SendMessageResult> {
    return { success: false, reason: "not_implemented" };
  }

  onEvent(handler: MessagingProviderEventHandler): () => void {
    return this.pool.onEvent((event) => {
      const statusChange: MessagingProviderEvent = {
        type: "statusChange",
        tenantId: event.tenantId,
        snapshot: event.snapshot,
      };
      handler(statusChange);
      if (event.permanentDisconnect) {
        handler({ type: "permanentDisconnect", tenantId: event.tenantId });
      }
    });
  }
}
