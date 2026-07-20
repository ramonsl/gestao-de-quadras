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

export const sql = neon(databaseUrl);
export const db = drizzle(sql, { schema });
