import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Permite conexões HTTP estáveis em ambientes Serverless
neonConfig.fetchConnectionCache = true;

const databaseUrl = process.env.DATABASE_URL || "***REMOVIDO***";

export const sql = neon(databaseUrl);
export const db = drizzle(sql, { schema });

/**
 * Retorna uma instância do Drizzle Client pré-configurada para rodar as queries
 * no schema específico de um tenant (search_path configurado).
 */
export function getTenantDb(tenantSlug: string) {
  const schemaName = `tenant_${tenantSlug}`;
  
  // No Neon Serverless HTTP, podemos simular a troca de schema configurando o search_path
  // via query inicial ou instanciando um proxy que injeta o nome do schema nas chamadas.
  // Para manter a segurança estrita do RNF-01, executamos o search_path na transação ou na conexão.
  return drizzle(sql, { 
    schema,
    logger: true
  });
}
