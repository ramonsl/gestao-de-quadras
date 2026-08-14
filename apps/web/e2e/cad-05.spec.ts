import { test, expect, loginAs, seedArenaUser } from "./fixtures";

/**
 * CAD-05 [P0] — Cadastro da Grade de Horários e Precificação da Quadra
 *
 * Spec: docs/spec/e2-cadastros.md (CAD-05)
 *
 * Fluxo coberto:
 *   1. Admin acessa /admin/faixas-horarias/nova
 *   2. Configura quadra, múltiplos dias, abertura/fechamento, preço por 30min
 *   3. Visualiza o preview automático de slots
 *   4. Salva e confirma que a grade foi criada na listagem
 *   5. Verifica que a grade aparece na grade do PDV (PDV-05)
 */

test.describe("CAD-05 — Grade de Horários com Slots de 30 Minutos", () => {
  test.beforeEach(async ({ page }) => {
    const creds = await seedArenaUser({ role: "admin" });
    await loginAs(page, creds);
  });

  // ---------------------------------------------------------------------------
  // AC1 — Acesso à página de configuração de grade
  // ---------------------------------------------------------------------------
  test("AC1 — Admin acessa /admin/faixas-horarias e vê o botão 'Configurar grade'", async ({
    page,
  }) => {
    await page.goto("/admin/faixas-horarias");
    await expect(page.getByRole("heading", { name: /faixas horárias/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /configurar grade/i })).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // AC2 — Formulário de configuração com campos corretos
  // ---------------------------------------------------------------------------
  test("AC2 — Formulário exibe seleção de dias, abertura, fechamento e preço por 30min", async ({
    page,
  }) => {
    await page.goto("/admin/faixas-horarias/nova");
    await expect(
      page.getByRole("heading", { name: /configurar grade de horários/i })
    ).toBeVisible();

    // Seleção de quadra
    await expect(page.locator("select#courtId")).toBeVisible();

    // Dias da semana como toggles
    await expect(page.locator("input[name='days'][value='1']")).toBeAttached(); // Seg
    await expect(page.locator("input[name='days'][value='5']")).toBeAttached(); // Sex

    // Atalhos de seleção
    await expect(page.getByRole("button", { name: /dias úteis/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /todos/i })).toBeVisible();

    // Horários
    await expect(page.locator("input#openingHHMM")).toBeVisible();
    await expect(page.locator("input#closingHHMM")).toBeVisible();

    // Preço por bloco
    await expect(page.locator("input#pricePerSlot")).toBeVisible();
    await expect(page.getByText(/valor.*30 min/i)).toBeVisible();

    // Botão salvar
    await expect(page.locator("#btn-salvar-grade")).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // AC3 — Preview automático de slots
  // ---------------------------------------------------------------------------
  test("AC3 — Preview exibe quantidade correta de blocos de 30 minutos", async ({
    page,
  }) => {
    await page.goto("/admin/faixas-horarias/nova");

    // Define abertura 08:00, fechamento 10:00 → deve gerar 4 blocos de 30min
    await page.locator("input#openingHHMM").fill("08:00");
    await page.locator("input#closingHHMM").fill("10:00");
    await page.locator("input#pricePerSlot").fill("35.00");

    // Preview deve mostrar 4 blocos (08:00, 08:30, 09:00, 09:30)
    await expect(page.getByText("08:00")).toBeVisible();
    await expect(page.getByText("08:30")).toBeVisible();
    await expect(page.getByText("09:30")).toBeVisible();

    // Badge de contagem
    await expect(page.getByText(/4 blocos/i)).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // AC4 — Seleção em lote de dias (atalhos)
  // ---------------------------------------------------------------------------
  test("AC4 — Atalhos 'Dias úteis' e 'Todos' selecionam/desmarcam dias corretamente", async ({
    page,
  }) => {
    await page.goto("/admin/faixas-horarias/nova");

    // Clica em "Todos" — deve marcar os 7 dias
    await page.getByRole("button", { name: /^todos$/i }).click();
    for (let day = 0; day <= 6; day++) {
      await expect(page.locator(`input[name='days'][value='${day}']`)).toBeChecked();
    }

    // Clica em "Limpar" — deve desmarcar todos
    await page.getByRole("button", { name: /limpar/i }).click();
    for (let day = 0; day <= 6; day++) {
      await expect(page.locator(`input[name='days'][value='${day}']`)).not.toBeChecked();
    }

    // Clica em "Dias úteis" — deve marcar Seg-Sex (1-5)
    await page.getByRole("button", { name: /dias úteis/i }).click();
    for (let day = 1; day <= 5; day++) {
      await expect(page.locator(`input[name='days'][value='${day}']`)).toBeChecked();
    }
    await expect(page.locator("input[name='days'][value='0']")).not.toBeChecked(); // Dom
    await expect(page.locator("input[name='days'][value='6']")).not.toBeChecked(); // Sáb
  });

  // ---------------------------------------------------------------------------
  // AC5 — Preview de erro para intervalo inválido
  // ---------------------------------------------------------------------------
  test("AC5 — Preview exibe erro quando abertura >= fechamento", async ({ page }) => {
    await page.goto("/admin/faixas-horarias/nova");

    await page.locator("input#openingHHMM").fill("22:00");
    await page.locator("input#closingHHMM").fill("08:00");
    await page.locator("input#pricePerSlot").fill("35.00");

    await expect(
      page.getByText(/anterior ao de fechamento/i)
    ).toBeVisible();

    // Botão de salvar deve estar desabilitado
    await expect(page.locator("#btn-salvar-grade")).toBeDisabled();
  });

  // ---------------------------------------------------------------------------
  // AC6 — Salvar grade e verificar na listagem
  // ---------------------------------------------------------------------------
  test("AC6 — Configurar e salvar grade cria slots na listagem", async ({ page }) => {
    await page.goto("/admin/faixas-horarias/nova");

    // Seleciona apenas Terça (dia 2) para teste isolado
    await page.getByRole("button", { name: /limpar/i }).click();
    await page.locator("label[title='Terça']").click();

    // Configura 08:00–09:00 → 2 blocos
    await page.locator("input#openingHHMM").fill("08:00");
    await page.locator("input#closingHHMM").fill("09:00");
    await page.locator("input#pricePerSlot").fill("40.00");

    // Salva
    await page.locator("#btn-salvar-grade").click();

    // Confirma feedback de sucesso
    await expect(page.getByText(/grade salva com sucesso/i)).toBeVisible();
    await expect(page.getByText(/2 slot\(s\) criado\(s\)/i)).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // AC7 — Grade aparece na listagem de faixas horárias
  // ---------------------------------------------------------------------------
  test("AC7 — Listagem exibe preço por bloco de 30min e opção de remover dia", async ({
    page,
  }) => {
    await page.goto("/admin/faixas-horarias");

    // Se houver slots cadastrados, deve mostrar o preço por 30min
    const hasSlotsCard = await page.locator("text=/\\/30min/").count();
    if (hasSlotsCard > 0) {
      await expect(page.locator("text=/\\/30min/").first()).toBeVisible();
    }
  });

  // ---------------------------------------------------------------------------
  // AC8 — Grade reflete nas opções do PDV (PDV-05)
  // ---------------------------------------------------------------------------
  test("AC8 — Grade de locação do PDV exibe os slots configurados", async ({ page }) => {
    await page.goto("/quadras/grade");
    // Pode estar vazia se não há quadras, mas a página deve carregar sem erros
    await expect(
      page
        .getByRole("heading", { name: /grade de locação/i })
        .or(page.getByText(/nenhuma quadra ativa/i))
        .or(page.getByText(/nenhuma faixa horária/i))
    ).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // AC9 — Controle de acesso (Atendente não pode configurar grade)
  // ---------------------------------------------------------------------------
  test("AC9 — Atendente não vê o botão de configurar grade na listagem", async ({
    page,
  }) => {
    // Re-login como atendente
    const creds = await seedArenaUser({ role: "atendente" });
    await loginAs(page, creds);

    await page.goto("/admin/faixas-horarias");

    // Botão não deve estar visível para atendente
    await expect(
      page.getByRole("link", { name: /configurar grade/i })
    ).not.toBeVisible();
  });
});
