import { test, expect } from "@playwright/test";

/**
 * CAD-01 — Teste E2E
 * 4 critérios de aceite: cliente novo, cliente global, isolamento LGPD, busca PDV
 */

test.describe("CAD-01 — Cadastro de Clientes", () => {
  test("AC1: Cria novo cliente quando WhatsApp não existe no sistema", async ({
    page,
  }) => {
    // Pré-requisito: estar logado como Atendente/Gerente
    await page.goto("/dashboard");

    // Clica em "Novo Cliente" (ou acessa /customers/new)
    await page.click('button:has-text("Novo Cliente")');

    // Preenche WhatsApp novo
    await page.fill('[placeholder*="WhatsApp"]', "(11) 99876-5432");
    await page.click("button:has-text('Buscar')");
    await page.waitForTimeout(300);

    // Sistema não encontra → mostra formulário
    expect(await page.locator('input[name="name"]').isVisible()).toBeTruthy();

    // Preenche dados
    await page.fill('input[name="name"]', "João Silva");
    await page.fill('input[name="email"]', "joao@email.com");
    await page.fill('input[name="birthDate"]', "1985-03-20");
    await page.click('input[type="checkbox"][name="optInLgpd"]');

    // Submete
    await page.click("button:has-text('Criar Cliente')");

    // Verifica sucesso
    await expect(
      page.locator("text=/[Cc]liente criado com sucesso/")
    ).toBeVisible();
  });

  test("AC2: Vincula cliente existente (identidade global)", async ({
    page,
  }) => {
    // Pré-requisito: existe cliente global com WhatsApp +5511999999999

    await page.goto("/dashboard");
    await page.click('button:has-text("Novo Cliente")');

    // Busca WhatsApp que já existe globalmente
    await page.fill('[placeholder*="WhatsApp"]', "+5511999999999");
    await page.click("button:has-text('Buscar')");
    await page.waitForTimeout(300);

    // Sistema encontra → mostra confirmação
    expect(
      await page.locator("text=Cliente já registrado no sistema").isVisible()
    ).toBeTruthy();
    expect(await page.locator("text=Maria Silva").isVisible()).toBeTruthy();

    // Confirma vinculação
    await page.click("button:has-text('Vincular desta arena')");

    // Verifica sucesso
    await expect(
      page.locator("text=/[Vv]inculado com sucesso/")
    ).toBeVisible();
  });

  test("AC3: Opt-in LGPD isolado por arena", async ({ browser }) => {
    // Arena A: cria cliente com opt-in=true
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await pageA.goto("/dashboard");
    await pageA.click('button:has-text("Novo Cliente")');
    await pageA.fill('[placeholder*="WhatsApp"]', "+5511988888888");
    await pageA.fill('input[name="name"]', "Carlos");
    await pageA.click('input[name="optInLgpd"]');
    await pageA.click("button:has-text('Criar Cliente')");
    await pageA.waitForTimeout(500);

    // Verifica opt-in=true na Arena A
    await pageA.goto("/dashboard/customers");
    await pageA.click('text=Carlos');
    expect(
      await pageA.locator("text=Consentimento: ativado").isVisible()
    ).toBeTruthy();

    // Arena B: vincula mesmo cliente SEM opt-in
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await pageB.goto("/dashboard");
    await pageB.click('button:has-text("Novo Cliente")');
    await pageB.fill('[placeholder*="WhatsApp"]', "+5511988888888");
    await pageB.click("button:has-text('Buscar')");
    await pageB.waitForTimeout(300);
    await pageB.click("button:has-text('Vincular desta arena')");

    // Verifica opt-in=false na Arena B
    await pageB.goto("/dashboard/customers");
    await pageB.click('text=Carlos');
    expect(
      await pageB.locator("text=Consentimento: desativado").isVisible()
    ).toBeTruthy();

    // Ativa opt-in na Arena B
    await pageB.click('button:has-text("Ativar consentimento")');
    expect(
      await pageB.locator("text=Consentimento: ativado").isVisible()
    ).toBeTruthy();

    // Volta à Arena A: ainda está ativado (isolado)
    const pageA2 = await contextA.newPage();
    await pageA2.goto("/dashboard/customers");
    await pageA2.click('text=Carlos');
    expect(
      await pageA2.locator("text=Consentimento: ativado").isVisible()
    ).toBeTruthy();

    await contextA.close();
    await contextB.close();
  });

  test("AC4: Busca rápida no PDV", async ({ page }) => {
    // Pré-requisito: clientes existentes (Maria, Mariana, João)

    await page.goto("/pdv");

    // Clica em "Abrir Comanda"
    await page.click("button:has-text('Abrir Comanda')");

    // Busca por nome parcial
    const searchInput = page.locator('[placeholder*="Buscar cliente"]');
    await searchInput.fill("maria");
    await page.waitForTimeout(300);

    // Mostra sugestões
    expect(await page.locator("text=Maria Silva").isVisible()).toBeTruthy();
    expect(await page.locator("text=Mariana Costa").isVisible()).toBeTruthy();

    // Clica para selecionar
    await page.click("text=Maria Silva");

    // Verifica que foi selecionado
    expect(
      await page
        .locator('[data-testid="comanda-customer"]')
        .first()
        .textContent()
    ).toContain("Maria Silva");

    // Busca por WhatsApp
    await searchInput.fill("+5511987654321");
    await page.waitForTimeout(300);

    expect(await page.locator("text=João").isVisible()).toBeTruthy();
  });
});
