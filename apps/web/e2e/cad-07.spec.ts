import { test, expect, loginAs, seedArenaUser } from "./fixtures";

/**
 * CAD-07 [P1] — Configurações de Impressão Térmica do Tenant
 *
 * Spec: docs/spec/e2-cadastros.md (CAD-07)
 *
 * Fluxos cobertos:
 *   AC1 — Admin altera tamanho do papel para "58mm" e salva → toast de sucesso
 *   AC2 — Admin habilita impressão automática de fichas de produção
 *   AC3 — Admin salva cabeçalho e rodapé; ao recarregar, valores persistem
 *   AC4 — Gerente acessa a página com sucesso; atendente é redirecionado
 */

test.describe("CAD-07 — Configurações de Impressão Térmica", () => {
  test.beforeEach(async ({ page }) => {
    const creds = await seedArenaUser({ role: "admin" });
    await loginAs(page, creds);
  });

  // -------------------------------------------------------------------------
  // AC1 — Alterar tamanho do papel e salvar
  // -------------------------------------------------------------------------
  test("AC1 — Admin altera paperSize para 58mm e vê confirmação de sucesso", async ({
    page,
  }) => {
    await page.goto("/admin/impressao");

    await expect(
      page.getByRole("heading", { name: /configurações de impressão térmica/i })
    ).toBeVisible();

    // Altera o tamanho do papel para 58mm
    await page.locator("select#paperSize").selectOption("58mm");
    await expect(page.locator("select#paperSize")).toHaveValue("58mm");

    // Submete o formulário
    await page.getByRole("button", { name: /salvar configurações/i }).click();

    // Aguarda a confirmação de sucesso (sem sleep fixo — auto-wait do Playwright)
    await expect(
      page.getByText(/configurações salvas com sucesso/i)
    ).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // AC2 — Toggle de impressão automática
  // -------------------------------------------------------------------------
  test("AC2 — Admin habilita impressão automática de fichas de produção", async ({
    page,
  }) => {
    await page.goto("/admin/impressao");

    const toggle = page.locator("input#autoPrintProductionTickets");

    // Registra estado inicial para depois inverter
    const wasChecked = await toggle.isChecked();

    if (wasChecked) {
      await toggle.uncheck();
      await page.getByRole("button", { name: /salvar configurações/i }).click();
      await expect(page.getByText(/configurações salvas com sucesso/i)).toBeVisible();
      // Recarrega para garantir estado limpo
      await page.goto("/admin/impressao");
    }

    // Agora habilita o toggle
    await toggle.check();
    await expect(toggle).toBeChecked();

    await page.getByRole("button", { name: /salvar configurações/i }).click();
    await expect(page.getByText(/configurações salvas com sucesso/i)).toBeVisible();

    // Recarrega e confirma que o toggle está marcado
    await page.reload();
    await expect(page.locator("input#autoPrintProductionTickets")).toBeChecked();
  });

  // -------------------------------------------------------------------------
  // AC3 — Cabeçalho e rodapé persistem após recarregar
  // -------------------------------------------------------------------------
  test("AC3 — Admin salva cabeçalho e rodapé; valores persistem ao recarregar", async ({
    page,
  }) => {
    await page.goto("/admin/impressao");

    const uniqueHeader = `Arena Teste ${Date.now()}`;
    const uniqueFooter = `Rodapé Teste ${Date.now()}`;

    await page.locator("textarea#receiptHeader").fill(uniqueHeader);
    await page.locator("textarea#receiptFooter").fill(uniqueFooter);

    await page.getByRole("button", { name: /salvar configurações/i }).click();
    await expect(page.getByText(/configurações salvas com sucesso/i)).toBeVisible();

    // Recarrega a página e verifica que os valores persistem
    await page.reload();

    await expect(page.locator("textarea#receiptHeader")).toHaveValue(uniqueHeader);
    await expect(page.locator("textarea#receiptFooter")).toHaveValue(uniqueFooter);
  });

  // -------------------------------------------------------------------------
  // AC4 — Controle de acesso: gerente acessa; atendente é redirecionado
  // -------------------------------------------------------------------------
  test("AC4 — Gerente acessa /admin/impressao com sucesso", async ({ page }) => {
    const creds = await seedArenaUser({ role: "gerente" });
    await loginAs(page, creds);

    await page.goto("/admin/impressao");

    await expect(
      page.getByRole("heading", { name: /configurações de impressão térmica/i })
    ).toBeVisible();

    // Gerente pode ver o formulário mas não deve criar dados de outro tenant
    await expect(page.locator("select#paperSize")).toBeVisible();
    await expect(page.locator("textarea#receiptHeader")).toBeVisible();
  });

  test("AC4 — Atendente é redirecionado ao acessar /admin/impressao", async ({
    page,
  }) => {
    const creds = await seedArenaUser({ role: "atendente" });
    await loginAs(page, creds);

    await page.goto("/admin/impressao");

    // Deve ser redirecionado — não pode acessar a página
    await expect(page).not.toHaveURL(/\/admin\/impressao/);
  });
});
