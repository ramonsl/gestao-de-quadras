import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type * as schema from "@gestao-de-quadras/db/schema";

/**
 * Isolamento de tenant — DISCRIMINADOR POR LINHA (ver Regra inviolável #1).
 *
 * Toda tabela de arena carrega `tenant_id`. Os serviços recebem o `TenantContext`
 * e SEMPRE filtram/gravam `tenant_id` explicitamente — este é o mecanismo de
 * isolamento. RLS do Postgres está previsto como reforço (hardening) num passo
 * dedicado; quando entrar, o ponto de acesso continua sendo este contexto.
 */

/** Conexão Drizzle compartilhada (expõe `.execute` para SQL parametrizado). */
export type ArenaDb = NeonHttpDatabase<typeof schema>;

export interface TenantContext {
  db: ArenaDb;
  /** UUID da arena (public.tenants.id). */
  tenantId: string;
  /** users_tenants.id do operador que executa a ação (auditoria). */
  actorUserId?: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valida o tenantId antes de entrar no SQL (barra injeção / id malformado). */
export function assertTenantId(tenantId: string): void {
  if (!UUID_PATTERN.test(tenantId)) {
    throw new Error(`tenant_id inválido: "${tenantId}".`);
  }
}

/** Extrai as linhas tipadas do resultado de `db.execute`. */
export function rows<T>(result: { rows: unknown[] }): T[] {
  return result.rows as unknown as T[];
}
