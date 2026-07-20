/**
 * Lê a URL do banco exclusivamente do ambiente.
 *
 * Não existe fallback: sem DATABASE_URL a aplicação falha imediatamente, em vez
 * de conectar silenciosamente em uma instância que ninguém configurou.
 */
export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL não definida. Configure a variável de ambiente antes de iniciar a aplicação (veja .env.example).",
    );
  }

  return databaseUrl;
}
