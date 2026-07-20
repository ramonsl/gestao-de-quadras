import { defineConfig, devices } from "@playwright/test";

/**
 * Config Playwright do Arena SaaS (apps/web).
 *
 * PRÉ-REQUISITOS para rodar (`pnpm e2e`):
 *   1. `pnpm --filter web exec playwright install chromium` (baixa o browser)
 *   2. Postgres + Redis de teste no ar e migrations aplicadas (`pnpm db:migrate`)
 *   3. `DATABASE_URL` / `TEST_BASE_URL` apontando para o ambiente de teste
 *
 * O tenant é resolvido pelo subdomínio; em dev/CI usamos `TEST_TENANT_SLUG`
 * e o campo hidden `tenantSlug` do formulário de login.
 */
const baseURL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Sobe o Next automaticamente ao rodar localmente (desligue em CI se já houver server).
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : {
        command: "pnpm --filter web dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
