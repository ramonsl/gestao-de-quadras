/**
 * Tipo do handle de banco passado às services de CAD-01 (customer.service).
 *
 * TODO (dívida técnica): hoje é permissivo porque `customer.service` chama
 * `db.insert/select/...` diretamente, enquanto os call sites passam o
 * `TenantDbClient` (wrapper `{ db, schemaName, executeInTenant }`) — os dois
 * formatos não batem, o que também é um bug de runtime. A correção é migrar
 * `customer.service` para `TenantDbClient` + `executeInTenant`, como já foi
 * feito em `packages/core/src/product/product.service.ts`.
 */
export type TenantDb = any;
