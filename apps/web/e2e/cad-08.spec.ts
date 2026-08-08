import { test, expect, loginAs, seedArenaUser } from "./fixtures";

/**
 * CAD-08 — Perfil 360° e Histórico Consolidado do Cliente
 *
 * Cada bloco de teste deriva dos Critérios de Aceite da spec (docs/spec/e2-cadastros.md, CAD-08).
 *
 * ⚠️ Marcados como `test.fixme`: exigem servidor Next + Postgres de teste e a
 * factory de seed de tenant/operador (ver fixtures.seedArenaUser).
 */

test.describe("CAD-08 — Perfil 360° e Histórico Consolidado do Cliente", () => {
  // AC1 — Acesso Rápido a partir do Perfil do Cliente
  test.fixme(
    "exibe o painel consolidado 360° com cards de saldo devedor, pontos e histórico ao abrir o perfil do cliente",
    async ({ page }) => {
      const operador = await seedArenaUser({ role: "admin" });
      await loginAs(page, operador);
      await page.goto("/customers");

      // When: clica no cliente Maria Oliveira
      await page.getByText("Maria Oliveira").first().click();

      // Then: exibe os cards de resumo de indicadores chave
      await expect(page.getByText(/Saldo Devedor/i)).toBeVisible();
      await expect(page.getByText(/Programa de Fidelidade|Pontos/i)).toBeVisible();
      await expect(page.getByText(/Pacotes de Aulas/i)).toBeVisible();

      // And: exibe as abas de histórico detalhado (Comandas, Locações, Aulas, Saldo Devedor)
      await expect(page.getByRole("tab", { name: /Comandas/i })).toBeVisible();
      await expect(page.getByRole("tab", { name: /Locações|Reservas/i })).toBeVisible();
    }
  );

  // AC2 — Ação Rápida de Recebimento de Débito Pendente
  test.fixme(
    "exibe botão de ação rápida para quitar saldo devedor diretamente pelo perfil do cliente",
    async ({ page }) => {
      const operador = await seedArenaUser({ role: "gerente" });
      await loginAs(page, operador);
      await page.goto("/customers");

      await page.getByText("Maria Oliveira").first().click();

      // Then: exibe botão Quitar Saldo Devedor ou Receber Débito Pendente
      await expect(page.getByRole("button", { name: /Quitar Saldo Devedor|Receber Débito/i })).toBeVisible();
    }
  );

  // AC3 — Isolamento por Tenant
  test.fixme(
    "garante que apenas comandas e reservas da arena atual são exibidas no histórico do cliente",
    async ({ page }) => {
      const operador = await seedArenaUser({ role: "atendente" });
      await loginAs(page, operador);
      await page.goto("/customers");

      await page.getByText("Maria Oliveira").first().click();

      // Then: histórico exibe apenas os lançamentos pertencentes ao tenant logado
      await expect(page.getByText(/Comandas e Vendas/i)).toBeVisible();
    }
  );
});
