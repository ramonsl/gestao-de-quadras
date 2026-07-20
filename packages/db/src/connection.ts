import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
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

/**
 * Instância Drizzle compartilhada. Modelo row-level: o isolamento entre arenas
 * é por `tenant_id` nas queries dos serviços (ver Regra inviolável #1), não por
 * schema físico — por isso não há mais `getTenantDb`/`search_path` aqui.
 */
export const db = drizzle(sqlConnection, {
  schema,
  logger: isLoggingEnabled,
});
