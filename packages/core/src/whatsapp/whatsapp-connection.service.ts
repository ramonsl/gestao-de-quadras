import { sql } from "drizzle-orm";
import { assertTenantId, rows, type ArenaDb } from "../db/tenant";

/**
 * Postgres devolve `timestamp without time zone` como string sem sufixo de
 * fuso (ex.: "2026-01-02 10:30:00.654321") — todas as colunas de timestamp
 * deste projeto são gravadas via `now()` (UTC). `new Date(str)` sem "Z"
 * interpretaria isso como hora local da máquina, não UTC. Aceita `Date`
 * também porque os mocks de teste já devolvem `Date`.
 */
function parseTimestamp(value: string | Date | number): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  const hasTimezone = /[Zz]|[+-]\d{2}:?\d{2}$/.test(value);
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(hasTimezone ? iso : `${iso}Z`);
}

export type WhatsAppConnectionStatus =
  | "disconnected"
  | "connecting"
  | "qr_pending"
  | "connected"
  | "disconnected_permanent";

export interface WhatsAppConnectionStatusView {
  status: WhatsAppConnectionStatus;
  qrCode: string | null;
  phoneNumber: string | null;
  connectedAt: Date | null;
  lastDisconnectedAt: Date | null;
  reconnectAttempts: number;
  updatedAt: Date;
}

export interface WhatsAppConnectionContext {
  db: ArenaDb;
  /** UUID da arena (public.tenants.id). */
  tenantId: string;
  /** users_tenants.id do Admin que executa a ação (auditoria). */
  actorUserId: string;
}

/**
 * Payload do comando de conexão — a fila concreta (BullMQ) vive em
 * `packages/messaging`; este serviço só depende deste contrato mínimo,
 * nunca do pacote de mensageria (mantém `packages/core` livre de Baileys/BullMQ).
 */
export interface WhatsAppControlJob {
  type: "connect" | "disconnect";
  tenantId: string;
  requestedByUserId: string;
}

export interface WhatsAppControlQueuePort {
  enqueue(job: WhatsAppControlJob): Promise<void>;
}

/**
 * `db.execute()` cru (sem schema tipado) devolve timestamps como string
 * (formato `timestamp without time zone` do Postgres), não como `Date` — o
 * driver só faz essa conversão via query builder tipado do Drizzle. Os mocks
 * de teste devolvem `Date` diretamente. `toView()` normaliza os dois casos
 * via `parseTimestamp()` antes de expor ao chamador.
 */
type ConnectionRow = {
  status: WhatsAppConnectionStatus;
  qr_code: string | null;
  phone_number: string | null;
  connected_at: string | Date | number | null;
  last_disconnected_at: string | Date | number | null;
  reconnect_attempts: number;
  updated_at: string | Date | number;
};

const COLUMNS = sql`status, qr_code, phone_number, connected_at, last_disconnected_at, reconnect_attempts, updated_at`;

const DISCONNECTED_DEFAULT: WhatsAppConnectionStatusView = {
  status: "disconnected",
  qrCode: null,
  phoneNumber: null,
  connectedAt: null,
  lastDisconnectedAt: null,
  reconnectAttempts: 0,
  updatedAt: new Date(0),
};

function toView(row: ConnectionRow): WhatsAppConnectionStatusView {
  return {
    status: row.status,
    qrCode: row.qr_code,
    phoneNumber: row.phone_number,
    connectedAt: row.connected_at ? parseTimestamp(row.connected_at) : null,
    lastDisconnectedAt: row.last_disconnected_at ? parseTimestamp(row.last_disconnected_at) : null,
    reconnectAttempts: row.reconnect_attempts,
    updatedAt: parseTimestamp(row.updated_at),
  };
}

async function fetchConnection(ctx: WhatsAppConnectionContext): Promise<ConnectionRow | null> {
  const result = await ctx.db.execute<ConnectionRow>(
    sql`SELECT ${COLUMNS} FROM whatsapp_connections WHERE tenant_id = ${ctx.tenantId} LIMIT 1`
  );
  return rows<ConnectionRow>(result)[0] ?? null;
}

async function writeAudit(
  ctx: WhatsAppConnectionContext,
  action: string,
  details: Record<string, unknown>
): Promise<void> {
  await ctx.db.execute(
    sql`INSERT INTO audit_logs (tenant_id, user_id, action, details)
        VALUES (${ctx.tenantId}, ${ctx.actorUserId}, ${action}, ${JSON.stringify(details)})`
  );
}

/** Linha ainda não existe até o primeiro `connect` — trata como `disconnected` (AC3). */
export async function getWhatsAppConnectionStatus(
  ctx: WhatsAppConnectionContext
): Promise<WhatsAppConnectionStatusView> {
  assertTenantId(ctx.tenantId);
  const row = await fetchConnection(ctx);
  return row ? toView(row) : DISCONNECTED_DEFAULT;
}

export type RequestConnectResult =
  | { success: true }
  | { success: false; reason: "already_connected" | "already_connecting" };

/** Admin pede para conectar (AC1) — grava auditoria e enfileira o comando para o Worker. */
export async function requestWhatsAppConnect(
  ctx: WhatsAppConnectionContext,
  queue: WhatsAppControlQueuePort
): Promise<RequestConnectResult> {
  assertTenantId(ctx.tenantId);
  const row = await fetchConnection(ctx);

  if (row?.status === "connected") return { success: false, reason: "already_connected" };
  if (row?.status === "connecting" || row?.status === "qr_pending") {
    return { success: false, reason: "already_connecting" };
  }

  await writeAudit(ctx, "whatsapp.connection.requested", {});
  await queue.enqueue({ type: "connect", tenantId: ctx.tenantId, requestedByUserId: ctx.actorUserId });
  return { success: true };
}

export type RequestDisconnectResult =
  | { success: true }
  | { success: false; reason: "not_connected" };

/** Admin pede para desconectar — grava auditoria e enfileira o comando para o Worker. */
export async function requestWhatsAppDisconnect(
  ctx: WhatsAppConnectionContext,
  queue: WhatsAppControlQueuePort
): Promise<RequestDisconnectResult> {
  assertTenantId(ctx.tenantId);
  const row = await fetchConnection(ctx);

  if (!row || row.status === "disconnected" || row.status === "disconnected_permanent") {
    return { success: false, reason: "not_connected" };
  }

  await writeAudit(ctx, "whatsapp.connection.disconnected_by_admin", {});
  await queue.enqueue({ type: "disconnect", tenantId: ctx.tenantId, requestedByUserId: ctx.actorUserId });
  return { success: true };
}
