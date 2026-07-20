import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    // Specs de Playwright (apps/web/e2e) NÃO são testes Vitest — evita coleta acidental
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/e2e/**",
      "**/*.pw.spec.ts",
      // Worktrees do Claude Code contêm cópias do repo — não são alvo de teste
      "**/.claude/**",
    ],
    // URL fictícia: os testes unitários mockam o db, mas o módulo de conexão
    // exige a variável no import (nenhuma conexão é aberta).
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/test",
    },
  },
  resolve: {
    alias: {
      "@gestao-de-quadras/db": path.resolve(__dirname, "./packages/db/src"),
      "@gestao-de-quadras/db/schema": path.resolve(__dirname, "./packages/db/src/schema"),
      "@gestao-de-quadras/core": path.resolve(__dirname, "./packages/core/src"),
      "@gestao-de-quadras/core/auth/auth.service": path.resolve(__dirname, "./packages/core/src/auth/auth.service"),
      "@gestao-de-quadras/core/email/email.provider": path.resolve(__dirname, "./packages/core/src/email/email.provider"),
      "@gestao-de-quadras/core/users/user.service": path.resolve(__dirname, "./packages/core/src/users/user.service"),
      "@gestao-de-quadras/core/users/modules": path.resolve(__dirname, "./packages/core/src/users/modules"),
      "@": path.resolve(__dirname, "./apps/web/src"),
    },
  },
});
