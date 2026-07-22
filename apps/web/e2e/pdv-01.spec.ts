import { test, expect, loginAs, seedArenaUser } from "./fixtures";

/**
 * PDV-01 — Abertura e Fechamento de Caixa (sessão de turno), incluindo
 * sangrias/suprimentos e a conferência com apuração de sobra/quebra.
 *
 * Cada AC (docs/spec/e3-pdv.md, PDV-01) vira um caminho de ponta a ponta.
 *
 * ⚠️ Marcados como `test.fixme`: exigem servidor Next + Postgres de teste e uma
 * factory de seed de tenant/operador (ver fixtures.seedArenaUser). A cobertura
 * unitária das regras (already_open, session_closed, cálculo do resumo, apuração
 * de diferença) já existe em `packages/core/src/pdv/cash-session.service.test.ts`;
 * estes cenários exercitam o fluxo pela UM real. Convenções: sem sleeps fixos
 * (expects com auto-wait); dados por factory de seed, nunca herdados.
 *
 * Valores monetários são sempre em centavos no back; a UI recebe/exibe em reais.
 */

test.describe("PDV-01 — Abertura e fechamento de caixa", () => {
  // AC Abertura — informar saldo inicial (troco) abre o caixa do turno
  test.fixme("abre o caixa informando o saldo inicial e passa a exibir o caixa aberto", async ({ page }) => {
    const operador = await seedArenaUser({ role: "gerente", modulesAllowed: ["pdv"] });
    // Pré-condição: nenhum caixa aberto nesta arena.
    await loginAs(page, operador);
    await page.goto("/pdv");

    // Given: a barra de caixa indica que não há caixa aberto
    await expect(page.getByText("Nenhum Caixa Aberto no Momento")).toBeVisible();

    // When: o operador abre o caixa com R$ 100,00 de troco inicial
    await page.getByRole("button", { name: "Abrir Caixa" }).click();
    await expect(page.getByRole("heading", { name: /Abertura de Caixa/i })).toBeVisible();
    await page.getByLabel(/Saldo Inicial/i).fill("100,00");
    await page.getByRole("button", { name: /Abrir Caixa|Confirmar/i }).click();

    // Then: o caixa passa a constar como aberto, com o saldo inicial
    await expect(page.getByText("Nenhum Caixa Aberto no Momento")).toBeHidden();
    await expect(page.getByText(/R\$\s*100,00/)).toBeVisible();
  });

  // Regra — só um caixa aberto por vez (serviço: already_open)
  test.fixme("não permite abrir um segundo caixa enquanto houver um aberto", async ({ page }) => {
    const operador = await seedArenaUser({ role: "gerente", modulesAllowed: ["pdv"] });
    // Pré-condição: já existe um caixa aberto (seed).
    await loginAs(page, operador);
    await page.goto("/pdv");

    // Then: a ação de abrir não é oferecida; a barra mostra o caixa vigente
    await expect(page.getByRole("button", { name: "Abrir Caixa" })).toBeHidden();
    // (defesa no serviço) — se forçado, a mensagem de erro é exibida
    // "Já existe um caixa aberto nesta arena."
  });

  // AC (descrição) — Sangria e Suprimento registram movimentação no caixa aberto
  test.fixme("registra uma sangria (retirada) no caixa aberto", async ({ page }) => {
    const operador = await seedArenaUser({ role: "gerente", modulesAllowed: ["pdv"] });
    // Pré-condição: caixa aberto.
    await loginAs(page, operador);
    await page.goto("/pdv");

    // When: registra uma sangria de R$ 30,00 com motivo
    await page.getByRole("button", { name: /Sangria \/ Suprimento/i }).click();
    await expect(page.getByRole("heading", { name: /Movimentação de Caixa/i })).toBeVisible();
    await page.getByRole("button", { name: /Sangria \(Retirada\)/i }).click();
    await page.getByLabel(/Valor/i).fill("30,00");
    await page.getByLabel(/Motivo/i).fill("Retirada para depósito bancário");
    await page.getByRole("button", { name: "Confirmar Movimentação" }).click();

    // Then: a movimentação aparece e o esperado em dinheiro é reduzido em R$ 30,00
    await expect(page.getByText(/sangria/i)).toBeVisible();
  });

  // Regra 3 (CLAUDE.md) — sangria é ação sensível: atendente não pode
  test.fixme("bloqueia sangria para o perfil atendente (ação sensível — exige admin/gerente)", async ({ page }) => {
    const atendente = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
    // Pré-condição: caixa aberto.
    await loginAs(page, atendente);
    await page.goto("/pdv");

    // Then: o controle de sangria/suprimento não está disponível ao atendente
    await expect(page.getByRole("button", { name: /Sangria \/ Suprimento/i })).toBeHidden();
  });

  // Regra — lançar movimentação em caixa fechado falha (serviço: session_closed)
  test.fixme("não permite movimentação quando não há caixa aberto", async ({ page }) => {
    const operador = await seedArenaUser({ role: "gerente", modulesAllowed: ["pdv"] });
    // Pré-condição: nenhum caixa aberto.
    await loginAs(page, operador);
    await page.goto("/pdv");

    await expect(page.getByRole("button", { name: /Sangria \/ Suprimento/i })).toBeHidden();
  });

  // AC Fechamento — conferência por meio de pagamento com sobra/quebra
  test.fixme("fecha o caixa conferindo os valores contados e mostra a diferença (quebra)", async ({ page }) => {
    const operador = await seedArenaUser({ role: "gerente", modulesAllowed: ["pdv"] });
    // Pré-condição: caixa aberto com saldo inicial R$ 100,00 e uma venda em
    // dinheiro de R$ 50,00 → esperado em dinheiro = R$ 150,00 (seed).
    await loginAs(page, operador);
    await page.goto("/pdv");

    // When: inicia o fechamento e informa R$ 145,00 contados em dinheiro
    await page.getByRole("button", { name: /Fechar Caixa/i }).click();
    await expect(page.getByRole("heading", { name: /Fechamento e Conferência de Caixa/i })).toBeVisible();
    await page.getByLabel(/Dinheiro em Gaveta/i).fill("145,00");

    // Then: o resumo aponta uma QUEBRA de R$ 5,00 (contado < esperado)
    await expect(page.getByText(/quebra/i)).toBeVisible();
    await expect(page.getByText(/R\$\s*5,00/)).toBeVisible();

    // And: confirma o fechamento e o caixa volta a "nenhum caixa aberto"
    await page.getByRole("button", { name: "Confirmar e Fechar Caixa" }).click();
    await expect(page.getByText("Nenhum Caixa Aberto no Momento")).toBeVisible();
  });

  // AC Fechamento — contagem exata não gera diferença
  test.fixme("fecha o caixa sem diferença quando o contado bate com o esperado", async ({ page }) => {
    const operador = await seedArenaUser({ role: "gerente", modulesAllowed: ["pdv"] });
    // Pré-condição: caixa aberto; esperado em dinheiro = R$ 150,00 (seed).
    await loginAs(page, operador);
    await page.goto("/pdv");

    await page.getByRole("button", { name: /Fechar Caixa/i }).click();
    await page.getByLabel(/Dinheiro em Gaveta/i).fill("150,00");

    // Then: resumo sem sobra nem quebra
    await expect(page.getByText(/sem diferença|R\$\s*0,00/i)).toBeVisible();
  });
});
