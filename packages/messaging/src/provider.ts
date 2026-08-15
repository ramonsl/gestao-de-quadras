import type { WhatsAppConnectionSnapshot } from "./types";

export interface MessagingTenantRef {
  tenantId: string;
}

export interface SendMessageInput extends MessagingTenantRef {
  toE164: string;
  text: string;
}

export interface SendMessageResult {
  success: boolean;
  providerMessageId?: string;
  reason?: string;
}

export type MessagingProviderEvent =
  | { type: "statusChange"; tenantId: string; snapshot: WhatsAppConnectionSnapshot }
  | { type: "permanentDisconnect"; tenantId: string }
  | {
      type: "incomingMessage";
      tenantId: string;
      fromE164: string;
      text: string;
      baileysMessageId: string;
    };

export type MessagingProviderEventHandler = (event: MessagingProviderEvent) => void;

/**
 * Contrato único de mensageria (WPP-01, CLAUDE.md regra 1). Baileys é a
 * implementação de hoje — nenhum código fora de `packages/messaging` pode
 * depender dele diretamente; tudo passa por esta interface.
 */
export interface MessagingProvider {
  startConnection(ref: MessagingTenantRef): Promise<void>;
  disconnectConnection(ref: MessagingTenantRef): Promise<void>;
  getConnectionStatus(ref: MessagingTenantRef): Promise<WhatsAppConnectionSnapshot>;
  /** Contrato reservado para WPP-02/04 — implementação de envio fora do escopo da WPP-01. */
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
  /** Retorna uma função de unsubscribe. */
  onEvent(handler: MessagingProviderEventHandler): () => void;
}
