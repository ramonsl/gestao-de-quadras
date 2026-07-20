import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    // Specs de Playwright (apps/web/e2e) NÃO são testes Vitest — evita coleta acidental
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**", "**/*.pw.spec.ts"],
  },
  resolve: {
    alias: {
      "@gestao-de-quadras/db": path.resolve(__dirname, "./packages/db/src"),
      "@gestao-de-quadras/db/schema": path.resolve(__dirname, "./packages/db/src/schema"),
      "@gestao-de-quadras/core": path.resolve(__dirname, "./packages/core/src"),
      "@gestao-de-quadras/core/auth/auth.service": path.resolve(__dirname, "./packages/core/src/auth/auth.service"),
      "@gestao-de-quadras/core/email/email.provider": path.resolve(__dirname, "./packages/core/src/email/email.provider"),
    },
  },
});
