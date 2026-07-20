import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

/**
 * A URL do banco vem exclusivamente do ambiente. Nunca use fallback com
 * credencial embutida — o boot deve falhar alto se a variável não existir.
 */
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL não configurada. Defina a variável de ambiente antes de iniciar a aplicação."
  );
}

const isLoggingEnabled = process.env.DB_LOGGING === "true";

export const sqlConnection = neon(databaseUrl);
export const db = drizzle(sqlConnection, {
  schema,
  logger: isLoggingEnabled,
});

const SCHEMA_PATTERN = /^([a-z0-9-]+|tenant_[a-z0-9-]+)$/i;

/**
 * Normaliza e valida a string de entrada para o nome de schema físico do Postgres (ex.: `tenant_arena-x`).
 */
export function resolveTenantSchemaName(tenantSlugOrSchemaName: string): string {
  if (!tenantSlugOrSchemaName || typeof tenantSlugOrSchemaName !== "string") {
    throw new Error("Slug ou nome de schema de tenant é obrigatório.");
  }

  const trimmed = tenantSlugOrSchemaName.trim().toLowerCase();
  if (!SCHEMA_PATTERN.test(trimmed)) {
    throw new Error(`Identificador de tenant inválido: "${tenantSlugOrSchemaName}".`);
  }

  return trimmed.startsWith("tenant_") ? trimmed : `tenant_${trimmed}`;
}

// Tipo da transação/client do Drizzle retornado pelo Neon HTTP
export type TenantTxRunner = Parameters<Parameters<NeonHttpDatabase<typeof schema>["transaction"]>[0]>[0];

export type TenantDbClient = {
  db: NeonHttpDatabase<typeof schema>;
  schemaName: string;
  /**
   * Executa um callback dentro de um bloco isolado com `SET LOCAL search_path`
   * garantido para o schema do tenant.
   */
  executeInTenant: <T>(
    fn: (tx: TenantTxRunner) => Promise<T>
  ) => Promise<T>;
};

/**
 * Retorna o gerenciador do banco de dados isolado para o tenant especificado.
 * Conforme RNF-01 e Regra Inviolável #1 do CLAUDE.md:
 * - Valida rigorosamente o identificador do tenant contra injeção SQL.
 * - Garante que as queries rodem com `search_path = "tenant_<slug>", public`.
 * - Não usa logger hardcoded em produção.
 */
export function getTenantDb(tenantSlugOrSchemaName: string): TenantDbClient {
  const schemaName = resolveTenantSchemaName(tenantSlugOrSchemaName);

  return {
    db,
    schemaName,
    async executeInTenant<T>(
      fn: (tx: TenantTxRunner) => Promise<T>
    ): Promise<T> {
      return db.transaction(async (tx) => {
        // RNF-01: Configura o search_path isolado para o escopo desta transação no Postgres
        await tx.execute(sql.raw(`SET LOCAL search_path = "${schemaName}", public`));
        return fn(tx);
      });
    },
  };
}
