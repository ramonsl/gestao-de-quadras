/**
 * Superfície SEGURA de `packages/messaging` — nenhum arquivo re-exportado aqui
 * importa Baileys, por isso é o único ponto que `apps/web` pode importar
 * (ver alias único em `apps/web/tsconfig.json` e `vitest.config.ts`).
 *
 * A implementação concreta (`./baileys/*`) só é importada por `apps/worker`,
 * via caminho relativo — nunca através deste barrel.
 */
export * from "./types";
export * from "./provider";
export * from "./control-queue";
export * from "./events";
export * from "./fakes/fake-messaging-provider";
export * from "./notification-queue";
