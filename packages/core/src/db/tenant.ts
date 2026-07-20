import { sql, type SQL } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type * as schema from "@gestao-de-quadras/db/schema";

/**
 * Padrão MANDATÓRIO de isolamento de tenant (ver "Regra inviolável #1" do
 * CLAUDE.md): schema-por-tenant via SQL parametrizado que qualifica
 * explicitamente o schema do tenant com `sql.identifier`.
 *
 * NUNCA usar tabelas Drizzle qualificadas em `tenant_template` para runtime —
 * o SQL gerado fixaria o schema e vazaria dados entre arenas.
 */

/** Conexão Drizzle compartilhada (expõe `.execute` para SQL parametrizado). */
export type ArenaDb = NeonHttpDatabase<typeof schema>;

export interface TenantContext {
  db: ArenaDb;
  /** Nome físico do schema do tenant, ex.: `tenant_arena-x`. */
  schemaName: string;
  /** users_tenants.id do operador que executa a ação (auditoria). */
  actorUserId?: string;
}

const SCHEMA_PATTERN = /^tenant_[a-z0-9-]+$/;

/** Valida o nome do schema antes de entrar no SQL (barra injeção). */
export function assertSchema(schemaName: string): void {
  if (!SCHEMA_PATTERN.test(schemaName)) {
    throw new Error(`Nome de schema de tenant inválido: "${schemaName}".`);
  }
}

/** Referência qualificada `"tenant_<slug>"."<table>"` para interpolar no SQL. */
export function tenantTable(schemaName: string, table: string): SQL {
  return sql`${sql.identifier(schemaName)}.${sql.identifier(table)}`;
}

/** Extrai as linhas tipadas do resultado de `db.execute`. */
export function rows<T>(result: { rows: unknown[] }): T[] {
  return result.rows as unknown as T[];
}
