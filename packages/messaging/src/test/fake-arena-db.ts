import { sqlText } from "../../../core/src/test/sql-mock";
import type { ArenaDb } from "../db-types";

/**
 * Fake em memória de `ArenaDb` para os testes de `packages/messaging` — simula
 * as 3 tabelas da WPP-01 (`whatsapp_connections`, `whatsapp_auth_creds`,
 * `whatsapp_auth_keys`) o suficiente para exercitar repositório/pool/auth-state
 * sem Postgres real. Reaproveita `sqlText` de `packages/core` para introspecção
 * do SQL parametrizado do Drizzle (mesmo mecanismo do sql-mock), mas usa uma
 * extração de parâmetros PRÓPRIA (`sqlValues`) — o `sqlParams` do sql-mock
 * descarta valores `null` explicitamente interpolados (`if (n === null) return`),
 * o que desalinha as colunas UPDATE desta feature (vários campos vão a `null`,
 * ex.: `qr_code`, `permanent_alert_sent_at`).
 */

/** Como `sqlParams()` de sql-mock, mas preserva `null` como valor real. */
function sqlValues(node: unknown): unknown[] {
  const out: unknown[] = [];
  const walk = (n: unknown): void => {
    if (n === undefined) return;
    if (n === null) {
      out.push(null);
      return;
    }
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    const anyNode = n as {
      constructor?: { name?: string };
      queryChunks?: unknown[];
      valueOf?: () => unknown;
    };
    const name = anyNode.constructor?.name;
    if (name === "StringChunk" || name === "Name") return;
    if (Array.isArray(anyNode.queryChunks)) {
      anyNode.queryChunks.forEach(walk);
      return;
    }
    try {
      out.push(anyNode.valueOf ? anyNode.valueOf() : String(n));
    } catch {
      out.push(String(n));
    }
  };
  walk(node);
  return out;
}

export interface ConnectionRow {
  id: string;
  tenant_id: string;
  status: string;
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
}

// Ordem EXATA em que `updateConnection()` empilha os `SET` — ver connection-repository.ts.
const UPDATE_FIELDS_IN_ORDER: Array<[column: string, key: keyof ConnectionRow]> = [
  ["status", "status"],
  ["phone_number", "phone_number"],
  ["qr_code", "qr_code"],
  ["qr_generated_at", "qr_generated_at"],
  ["connected_at", "connected_at"],
  ["last_disconnected_at", "last_disconnected_at"],
  ["disconnect_reason", "disconnect_reason"],
  ["reconnect_attempts", "reconnect_attempts"],
  ["permanent_alert_sent_at", "permanent_alert_sent_at"],
];

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function newConnectionRow(tenantId: string): ConnectionRow {
  const now = new Date();
  return {
    id: nextId("conn"),
    tenant_id: tenantId,
    status: "disconnected",
    phone_number: null,
    qr_code: null,
    qr_generated_at: null,
    connected_at: null,
    last_disconnected_at: null,
    disconnect_reason: null,
    reconnect_attempts: 0,
    permanent_alert_sent_at: null,
    created_at: now,
    updated_at: now,
  };
}

function applyUpdateSet(text: string, params: unknown[], row: ConnectionRow): void {
  let paramIdx = 0;
  for (const [column, key] of UPDATE_FIELDS_IN_ORDER) {
    if (new RegExp(`\\b${column} = `).test(text)) {
      (row as unknown as Record<string, unknown>)[key] = params[paramIdx];
      paramIdx += 1;
    }
  }
}

export interface FakeArenaDb {
  db: ArenaDb;
  connections: Map<string, ConnectionRow>;
  /** tenant_id -> creds_json */
  creds: Map<string, string>;
  /** `${tenantId}:${type}:${id}` -> key_data */
  keys: Map<string, string>;
}

export function createFakeArenaDb(): FakeArenaDb {
  const connections = new Map<string, ConnectionRow>();
  const creds = new Map<string, string>();
  const keys = new Map<string, string>();

  const execute = async (sqlObj: unknown): Promise<{ rows: unknown[] }> => {
    const text = sqlText(sqlObj);
    const params = sqlValues(sqlObj);

    // --- whatsapp_connections ---------------------------------------------
    if (/whatsapp_connections/.test(text)) {
      if (/^\s*SELECT/i.test(text)) {
        const tenantId = params[0] as string;
        const row = connections.get(tenantId);
        return { rows: row ? [row] : [] };
      }
      if (/^\s*INSERT/i.test(text)) {
        const tenantId = params[0] as string;
        const existing = connections.get(tenantId);
        if (existing) return { rows: [existing] };
        const row = newConnectionRow(tenantId);
        connections.set(tenantId, row);
        return { rows: [row] };
      }
      if (/^\s*UPDATE/i.test(text)) {
        const tenantId = params[params.length - 1] as string;
        const row = connections.get(tenantId);
        if (!row) return { rows: [] };
        applyUpdateSet(text, params.slice(0, -1), row);
        row.updated_at = new Date();
        return { rows: [row] };
      }
    }

    // --- whatsapp_auth_creds ------------------------------------------------
    if (/whatsapp_auth_creds/.test(text)) {
      if (/^\s*SELECT/i.test(text)) {
        const tenantId = params[0] as string;
        const json = creds.get(tenantId);
        return { rows: json ? [{ creds_json: json }] : [] };
      }
      if (/^\s*INSERT/i.test(text)) {
        const [tenantId, json] = params as [string, string];
        creds.set(tenantId, json);
        return { rows: [] };
      }
      if (/^\s*DELETE/i.test(text)) {
        const tenantId = params[0] as string;
        creds.delete(tenantId);
        return { rows: [] };
      }
    }

    // --- whatsapp_auth_keys --------------------------------------------------
    if (/whatsapp_auth_keys/.test(text)) {
      if (/^\s*SELECT/i.test(text)) {
        const tenantId = params[0] as string;
        const type = params[1] as string;
        const rawIds = params[2];
        const ids = Array.isArray(rawIds) ? rawIds : (params.slice(2) as string[]);
        const rows = ids
          .map((id) => ({ id, data: keys.get(`${tenantId}:${type}:${id}`) }))
          .filter((r): r is { id: string; data: string } => r.data !== undefined)
          .map((r) => ({ key_id: r.id, key_data: r.data }));
        return { rows };
      }
      if (/^\s*INSERT/i.test(text)) {
        const [tenantId, type, id, data] = params as [string, string, string, string];
        keys.set(`${tenantId}:${type}:${id}`, data);
        return { rows: [] };
      }
      if (/^\s*DELETE/i.test(text)) {
        if (params.length === 1) {
          // DELETE ... WHERE tenant_id = $1 (limpeza total do tenant)
          const tenantId = params[0] as string;
          for (const k of [...keys.keys()]) if (k.startsWith(`${tenantId}:`)) keys.delete(k);
        } else {
          const [tenantId, type, id] = params as [string, string, string];
          keys.delete(`${tenantId}:${type}:${id}`);
        }
        return { rows: [] };
      }
    }

    return { rows: [] };
  };

  return { db: { execute }, connections, creds, keys };
}
