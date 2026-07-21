/**
 * Interface mínima de acesso ao banco exigida por `packages/messaging`.
 * Estrutural (não importa `ArenaDb`/`TenantContext` de `packages/core`) para
 * este pacote não depender de resolução cross-package fora do que o
 * monorepo já resolve de forma confiável (`drizzle-orm`, `zod`, Baileys).
 * Qualquer conexão Drizzle real (`NeonHttpDatabase`) satisfaz este shape.
 */
/**
 * `execute` é intencionalmente NÃO genérico aqui: uma conexão Drizzle real
 * (`NeonHttpDatabase<...>`) expõe `execute<T>(...)` genérico, mas dois métodos
 * genéricos declarados em interfaces independentes não são estruturalmente
 * compatíveis no TypeScript. Sem o genérico, a checagem é apenas "existe uma
 * chamada sem argumento de tipo que retorna algo com `.rows`?" — o que a
 * conexão real sempre satisfaz. A tipagem por linha continua explícita via
 * `rows<T>()` no ponto de uso, como no restante do repositório.
 */
export interface ArenaDb {
  execute(query: unknown): Promise<{ rows: unknown[] }>;
}

export interface TenantRef {
  db: ArenaDb;
  tenantId: string;
}

export function rows<T>(result: { rows: unknown[] }): T[] {
  return result.rows as unknown as T[];
}
