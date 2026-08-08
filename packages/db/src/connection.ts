import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { getDatabaseUrl } from "./env";

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

if (!process.env.DATABASE_URL) {
  const envPath = resolve(__dirname, "../../../apps/web/.env.local");
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        process.env[key] = value;
      }
    }
  }
}

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
