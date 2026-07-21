import { sql } from "drizzle-orm";
import type { ArenaDb, TenantRef } from "../db-types";
import { rows } from "../db-types";
import type { WhatsAppConnectionSnapshot, WhatsAppConnectionStatus } from "../types";

export interface WhatsAppConnectionRecord {
  id: string;
  tenantId: string;
  status: WhatsAppConnectionStatus;
  phoneNumber: string | null;
  qrCode: string | null;
  qrGeneratedAt: Date | null;
  connectedAt: Date | null;
  lastDisconnectedAt: Date | null;
  disconnectReason: string | null;
  reconnectAttempts: number;
  permanentAlertSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type ConnectionRow = {
  id: string;
  tenant_id: string;
  status: WhatsAppConnectionStatus;
  phone_number: string | null;
  qr_code: string | null;
  qr_generated_at: Date | null;
  connected_at: Date | null;
  last_disconnected_at: Date | null;
  disconnect_reason: string | null;
  reconnect_attempts: number;
  permanent_alert_sent_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

const COLUMNS = sql`id, tenant_id, status, phone_number, qr_code, qr_generated_at, connected_at,
  last_disconnected_at, disconnect_reason, reconnect_attempts, permanent_alert_sent_at, created_at, updated_at`;

function toRecord(row: ConnectionRow): WhatsAppConnectionRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    status: row.status,
    phoneNumber: row.phone_number,
    qrCode: row.qr_code,
    qrGeneratedAt: row.qr_generated_at,
    connectedAt: row.connected_at,
    lastDisconnectedAt: row.last_disconnected_at,
    disconnectReason: row.disconnect_reason,
    reconnectAttempts: row.reconnect_attempts,
    permanentAlertSentAt: row.permanent_alert_sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toSnapshot(record: WhatsAppConnectionRecord): WhatsAppConnectionSnapshot {
  return {
    status: record.status,
    qrCode: record.qrCode,
    phoneNumber: record.phoneNumber,
    reconnectAttempts: record.reconnectAttempts,
    updatedAt: record.updatedAt.toISOString(),
  };
}

/** Lê a linha singleton da arena (v1: 1 número por tenant) — cria se ainda não existir. */
export async function getOrCreateConnection(ref: TenantRef): Promise<WhatsAppConnectionRecord> {
  const existing = await ref.db.execute(
    sql`SELECT ${COLUMNS} FROM whatsapp_connections WHERE tenant_id = ${ref.tenantId} LIMIT 1`
  );
  const found = rows<ConnectionRow>(existing)[0];
  if (found) return toRecord(found);

  const inserted = await ref.db.execute(
    sql`INSERT INTO whatsapp_connections (tenant_id, status)
        VALUES (${ref.tenantId}, 'disconnected')
        ON CONFLICT (tenant_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id
        RETURNING ${COLUMNS}`
  );
  return toRecord(rows<ConnectionRow>(inserted)[0]);
}

export interface ConnectionUpdate {
  status?: WhatsAppConnectionStatus;
  phoneNumber?: string | null;
  qrCode?: string | null;
  qrGeneratedAt?: Date | null;
  connectedAt?: Date | null;
  lastDisconnectedAt?: Date | null;
  disconnectReason?: string | null;
  reconnectAttempts?: number;
  permanentAlertSentAt?: Date | null;
}

export async function updateConnection(
  ref: TenantRef,
  update: ConnectionUpdate
): Promise<WhatsAppConnectionRecord> {
  await getOrCreateConnection(ref); // garante a linha singleton antes do UPDATE

  const sets: ReturnType<typeof sql>[] = [];
  if (update.status !== undefined) sets.push(sql`status = ${update.status}`);
  if (update.phoneNumber !== undefined) sets.push(sql`phone_number = ${update.phoneNumber}`);
  if (update.qrCode !== undefined) sets.push(sql`qr_code = ${update.qrCode}`);
  if (update.qrGeneratedAt !== undefined) sets.push(sql`qr_generated_at = ${update.qrGeneratedAt}`);
  if (update.connectedAt !== undefined) sets.push(sql`connected_at = ${update.connectedAt}`);
  if (update.lastDisconnectedAt !== undefined)
    sets.push(sql`last_disconnected_at = ${update.lastDisconnectedAt}`);
  if (update.disconnectReason !== undefined) sets.push(sql`disconnect_reason = ${update.disconnectReason}`);
  if (update.reconnectAttempts !== undefined)
    sets.push(sql`reconnect_attempts = ${update.reconnectAttempts}`);
  if (update.permanentAlertSentAt !== undefined)
    sets.push(sql`permanent_alert_sent_at = ${update.permanentAlertSentAt}`);
  sets.push(sql`updated_at = now()`);

  const result = await ref.db.execute(
    sql`UPDATE whatsapp_connections SET ${sql.join(sets, sql`, `)}
        WHERE tenant_id = ${ref.tenantId}
        RETURNING ${COLUMNS}`
  );
  return toRecord(rows<ConnectionRow>(result)[0]);
}

export type { ArenaDb, TenantRef };
