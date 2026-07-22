/**
 * Tipos do domínio de mensageria (WPP-01). Nenhum arquivo deste módulo importa
 * Baileys — é a fatia segura para ser consumida pelo bundle web (apps/web).
 */

export type WhatsAppConnectionStatus =
  | "disconnected"
  | "connecting"
  | "qr_pending"
  | "connected"
  | "disconnected_permanent";

/** Snapshot exposto ao painel/eventos — datas sempre serializadas (ISO). */
export interface WhatsAppConnectionSnapshot {
  status: WhatsAppConnectionStatus;
  qrCode: string | null;
  phoneNumber: string | null;
  reconnectAttempts: number;
  updatedAt: string;
}

/**
 * Recorte do snapshot seguro para QUALQUER operador autenticado da arena
 * (não só Admin) — usado no indicador global de status. Nunca inclui
 * `qrCode` (segredo de pareamento) nem `phoneNumber`, que continuam
 * restritos ao painel `/whatsapp` (admin-only).
 */
export interface WhatsAppPublicStatus {
  status: WhatsAppConnectionStatus;
}

export function toPublicStatus(snapshot: WhatsAppConnectionSnapshot): WhatsAppPublicStatus {
  return { status: snapshot.status };
}
