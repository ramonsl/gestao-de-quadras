import { test, expect, loginAs, seedArenaUser } from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * CAD-08 — Perfil 360° e Histórico Consolidado do Cliente
 *
 * Cada bloco deriva dos Critérios de Aceite da spec (docs/spec/e2-cadastros.md, CAD-08).
 *
 * Pré-requisitos (mesmos do pdv-09.spec.ts, que roda de verdade no Chromium):
 *   - Next dev no ar (webServer do playwright.config, ou TEST_BASE_URL)
 *   - Postgres de teste migrado + `npm run db:seed`
 *   - O seed provisiona "Maria Oliveira" com comandas e um saldo devedor de
 *     R$ 250,00 (acima do limite de R$ 200,00), o que dispara o bloqueio de
 *     novas comandas/reservas exercitado no último cenário.
 */

/** Abre o Perfil 360° de Maria Oliveira a partir da lista de clientes. */
async function openMariaProfile(page: Page): Promise<void> {
  await page.goto("/customers");
  await page.getByRole("link", { name: "Maria Oliveira" }).first().click();
  // /customers/<uuid> — não confundir com /customers/new.
  await page.waitForURL(/\/customers\/[0-9a-f-]{36}/);
}

test.describe("CAD-08 — Perfil 360° e Histórico Consolidado do Cliente", () => {
  // AC — Acesso Rápido a partir do Perfil do Cliente
  test("exibe o painel 360° com os 4 cards de indicadores e as abas de histórico ao abrir o perfil", async ({
    page,
  }) => {
    const operador = await seedArenaUser({ role: "admin" });
    await loginAs(page, operador);
    await openMariaProfile(page);

    // Then: os 4 cards do barramento de indicadores (CardTitle = <h3>, role heading).
    await expect(page.getByRole("heading", { name: "Saldo Devedor" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Pontos.*Cashback/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pacotes de Aulas" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Consumo Total \(LTV\)/i })).toBeVisible();

    // And: as 4 abas de histórico detalhado.
    await expect(page.getByRole("tab", { name: "Comandas" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Locações e Reservas" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Aulas" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Saldo Devedor" })).toBeVisible();
  });

  // AC — Ações Rápidas do Gestor (Quick Action Bar)
  test("expõe as ações rápidas de abrir comanda e receber débito, com reservar/editar desabilitados", async ({
    page,
  }) => {
    const operador = await seedArenaUser({ role: "gerente" });
    await loginAs(page, operador);
    await openMariaProfile(page);

    // Then: ações disponíveis (links reais).
    await expect(page.getByRole("link", { name: "Abrir Nova Comanda" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Receber Débito Pendente" })).toBeVisible();

    // And: ações ainda não implementadas ficam desabilitadas (RES-01/CAD-06).
    await expect(page.getByRole("button", { name: /Reservar Quadra/i })).toBeDisabled();
    await expect(page.getByRole("button", { name: /Editar Dados/i })).toBeDisabled();
  });

  // AC — Isolamento de Dados por Tenant (Arena)
  test("exibe apenas o histórico de comandas da arena atual (aba Comandas por padrão)", async ({
    page,
  }) => {
    const operador = await seedArenaUser({ role: "atendente" });
    await loginAs(page, operador);
    await openMariaProfile(page);

    // Then: a aba Comandas (default) mostra o histórico do tenant logado.
    await expect(page.getByRole("heading", { name: "Comandas e Vendas" })).toBeVisible();
    // A comanda semeada de Maria aparece com um badge de status (Aberta/Fechada).
    await expect(page.getByText(/Aberta|Fechada/).first()).toBeVisible();

    // Nota: o isolamento estrito entre tenants (IDOR) é provado no teste unitário
    // `getCustomerProfile360` (retorna null para cliente de outro tenant),
    // pois o seed e2e provisiona um único tenant (`arena-demo`).
  });

  // AC — Sincronização do Saldo Devedor com Bloqueios
  test("destaca o bloqueio de novas comandas/reservas quando o saldo devedor excede o limite da arena", async ({
    page,
  }) => {
    const operador = await seedArenaUser({ role: "admin" });
    await loginAs(page, operador);
    await openMariaProfile(page);

    // Then: Maria tem débito de R$ 250,00 (> limite R$ 200,00) → alerta de bloqueio.
    // (`role="alert"` filtrado pelo título — o Next injeta um route-announcer
    // com o mesmo role, então escopo pelo texto do alerta de bloqueio.)
    const alert = page
      .getByRole("alert")
      .filter({ hasText: "Novas comandas e reservas bloqueadas" });
    await expect(alert).toBeVisible();

    // And: a aba de Saldo Devedor detalha o débito em aberto que originou o bloqueio.
    await page.getByRole("tab", { name: "Saldo Devedor" }).click();
    await expect(
      page.getByRole("heading", { name: "Saldo Devedor e Extrato de Cobrança" })
    ).toBeVisible();
    await expect(page.getByText("R$ 250,00").first()).toBeVisible();
  });
});
