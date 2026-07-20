import { sql } from "drizzle-orm";
import {
  initAuthCreds,
  BufferJSON,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataSet,
  type SignalDataTypeMap,
} from "@whiskeysockets/baileys";
import type { TenantRef } from "../db-types";
import { rows } from "../db-types";

async function loadCreds(ref: TenantRef): Promise<AuthenticationCreds> {
  const result = await ref.db.execute(
    sql`SELECT creds_json FROM whatsapp_auth_creds WHERE tenant_id = ${ref.tenantId} LIMIT 1`
  );
  const row = rows<{ creds_json: string }>(result)[0];
  if (!row) return initAuthCreds();
  return JSON.parse(row.creds_json, BufferJSON.reviver) as AuthenticationCreds;
}

async function persistCreds(ref: TenantRef, creds: AuthenticationCreds): Promise<void> {
  const json = JSON.stringify(creds, BufferJSON.replacer);
  await ref.db.execute(
    sql`INSERT INTO whatsapp_auth_creds (tenant_id, creds_json, updated_at)
        VALUES (${ref.tenantId}, ${json}, now())
        ON CONFLICT (tenant_id) DO UPDATE SET creds_json = EXCLUDED.creds_json, updated_at = now()`
  );
}

/** Remove credenciais e chaves de sinal — usado no logout permanente (AC4) e na desconexão manual. */
export async function clearAuthState(ref: TenantRef): Promise<void> {
  await ref.db.execute(sql`DELETE FROM whatsapp_auth_creds WHERE tenant_id = ${ref.tenantId}`);
  await ref.db.execute(sql`DELETE FROM whatsapp_auth_keys WHERE tenant_id = ${ref.tenantId}`);
}

async function getKeys<T extends keyof SignalDataTypeMap>(
  ref: TenantRef,
  type: T,
  ids: string[]
): Promise<{ [id: string]: SignalDataTypeMap[T] }> {
  const out: { [id: string]: SignalDataTypeMap[T] } = {};
  if (ids.length === 0) return out;

  const result = await ref.db.execute(
    sql`SELECT key_id, key_data FROM whatsapp_auth_keys
        WHERE tenant_id = ${ref.tenantId} AND key_type = ${type} AND key_id = ANY(${ids})`
  );
  for (const row of rows<{ key_id: string; key_data: string }>(result)) {
    let value = JSON.parse(row.key_data, BufferJSON.reviver);
    if (type === "app-state-sync-key" && value) {
      value = proto.Message.AppStateSyncKeyData.fromObject(value);
    }
    out[row.key_id] = value as SignalDataTypeMap[T];
  }
  return out;
}

async function setKeys(ref: TenantRef, data: SignalDataSet): Promise<void> {
  for (const type of Object.keys(data) as (keyof SignalDataTypeMap)[]) {
    const entries = data[type];
    if (!entries) continue;
    for (const id of Object.keys(entries)) {
      const value = (entries as Record<string, unknown>)[id];
      if (value === null || value === undefined) {
        await ref.db.execute(
          sql`DELETE FROM whatsapp_auth_keys
              WHERE tenant_id = ${ref.tenantId} AND key_type = ${type} AND key_id = ${id}`
        );
      } else {
        const json = JSON.stringify(value, BufferJSON.replacer);
        await ref.db.execute(
          sql`INSERT INTO whatsapp_auth_keys (tenant_id, key_type, key_id, key_data, updated_at)
              VALUES (${ref.tenantId}, ${type}, ${id}, ${json}, now())
              ON CONFLICT (tenant_id, key_type, key_id)
              DO UPDATE SET key_data = EXCLUDED.key_data, updated_at = now()`
        );
      }
    }
  }
}

/**
 * Monta o `AuthenticationState` do Baileys (creds + chaves de sinal) persistido
 * no Postgres, isolado por `tenant_id` (nunca em disco — ver decisão da WPP-01).
 */
export async function usePostgresAuthState(
  ref: TenantRef
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const creds = await loadCreds(ref);
  return {
    state: {
      creds,
      keys: {
        get: (type, ids) => getKeys(ref, type, ids),
        set: (data) => setKeys(ref, data),
      },
    },
    saveCreds: () => persistCreds(ref, creds),
  };
}
