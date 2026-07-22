import { test, expect, loginAs, seedArenaUser } from "./fixtures";

/**
 * PDV-07 — Fechamento de Comanda com Múltiplos Meios de Pagamento
 * (split exato, troco em dinheiro, desconto automático por filiação) e as
 * regras de guarda do serviço (pagamento insuficiente, dinheiro recebido menor
 * que o cobrado, comanda vazia) + o débito de estoque no fechamento (PDV → CAD-02).
 *
 * ACs em docs/spec/e3-pdv.md (PDV-07). A lógica de cálculo já tem cobertura
 * unitária em `packages/core/src/pdv/comanda.service.test.ts` (closeComanda);
 * estes cenários exercitam o fluxo pela UI real.
 *
 * ⚠️ `test.fixme`: exigem servidor Next + Postgres de teste e seed de
 * tenant/operador/cliente/produto/comanda. Convenções: sem sleeps fixos; dados
 * por factory de seed; valores em centavos no back, reais na UI.
 */

test.describe("PDV-07 — Fechamento de comanda com múltiplos meios de pagamento", () => {
  // AC — split exato entre dois meios encerra a comanda
  test.fixme("divide o total entre cartão e dinheiro (split exato) e fecha a comanda", async ({ page }) => {
    const operador = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
    // Pré-condição: comanda aberta com itens totalizando R$ 70,00 (seed) + caixa aberto.
    await loginAs(page, operador);
    await page.goto("/pdv/COMANDA_SEED_ID");

    // When: abre o fechamento e aloca R$ 50,00 no cartão de crédito
    await page.getByRole("button", { name: /Fechar (comanda|e pagar)/i }).click();
    await expect(page.getByRole("heading", { name: /Fechamento e Pagamento da Comanda/i })).toBeVisible();
    await page.getByLabel(/Meio de Pagamento/i).selectOption({ label: "Cartão de Crédito" });
    await page.getByLabel(/Valor/i).first().fill("50,00");

    // And: adiciona um segundo meio (dinheiro) com os R$ 20,00 restantes
    await page.getByRole("button", { name: "Adicionar outro meio de pagamento" }).click();
    await page.getByLabel(/Meio de Pagamento/i).last().selectOption({ label: "Dinheiro" });
    await page.getByLabel(/Valor Recebido/i).fill("20,00");

    // Then: total alocado cobre o total e o fechamento é permitido
    await expect(page.getByText(/Total Alocado nos Pagamentos:/i)).toContainText("70,00");
    await page.getByRole("button", { name: "Finalizar e Fechar Comanda" }).click();

    // And: a comanda sai da lista de abertas
    await expect(page).toHaveURL(/\/pdv$/);
  });

  // AC — pagamento em dinheiro calcula e exibe o troco
  test.fixme("calcula o troco quando o dinheiro recebido excede o valor cobrado", async ({ page }) => {
    const operador = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
    // Pré-condição: comanda de R$ 70,00 (seed).
    await loginAs(page, operador);
    await page.goto("/pdv/COMANDA_SEED_ID");

    await page.getByRole("button", { name: /Fechar (comanda|e pagar)/i }).click();
    await page.getByLabel(/Meio de Pagamento/i).selectOption({ label: "Dinheiro" });
    // When: recebe R$ 100,00 por uma comanda de R$ 70,00
    await page.getByLabel(/Valor Recebido/i).fill("100,00");

    // Then: o troco a devolver é R$ 30,00
    await expect(page.getByText(/Troco a Devolver:/i)).toContainText("30,00");
  });

  // Guarda — dinheiro recebido menor que o cobrado é rejeitado (invalid_cash_received)
  test.fixme("bloqueia quando o dinheiro recebido é menor que o valor cobrado", async ({ page }) => {
    const operador = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
    await loginAs(page, operador);
    await page.goto("/pdv/COMANDA_SEED_ID");

    await page.getByRole("button", { name: /Fechar (comanda|e pagar)/i }).click();
    await page.getByLabel(/Meio de Pagamento/i).selectOption({ label: "Dinheiro" });
    await page.getByLabel(/Valor Recebido/i).fill("50,00"); // comanda R$ 70,00

    await expect(
      page.getByText("O valor em dinheiro recebido é menor que o valor cobrado.")
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Finalizar e Fechar Comanda" })).toBeDisabled();
  });

  // Guarda — pagamento total menor que o total da comanda (insufficient_payment)
  test.fixme("não fecha quando o total pago é menor que o total da comanda", async ({ page }) => {
    const operador = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
    await loginAs(page, operador);
    await page.goto("/pdv/COMANDA_SEED_ID");

    await page.getByRole("button", { name: /Fechar (comanda|e pagar)/i }).click();
    await page.getByLabel(/Meio de Pagamento/i).selectOption({ label: "Pix" });
    await page.getByLabel(/Valor/i).first().fill("40,00"); // comanda R$ 70,00

    await expect(page.getByRole("button", { name: "Finalizar e Fechar Comanda" })).toBeDisabled();
  });

  // AC — desconto por filiação ativa é aplicado automaticamente ao total
  test.fixme("aplica automaticamente o desconto de filiação ativa antes do fechamento", async ({ page }) => {
    const operador = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
    // Pré-condição: comanda de R$ 100,00 de um cliente com filiação ativa que dá
    // 10% de desconto (ver FIL-01) → total final esperado R$ 90,00 (seed).
    await loginAs(page, operador);
    await page.goto("/pdv/COMANDA_SEED_ID");

    await page.getByRole("button", { name: /Fechar (comanda|e pagar)/i }).click();

    // Then: o total já vem com o desconto aplicado (sem ação manual do caixa)
    await expect(page.getByText(/Desconto/i)).toBeVisible();
    await expect(page.getByText(/Total.*R\$\s*90,00/i)).toBeVisible();
  });

  // Guarda — comanda sem itens não pode ser fechada (comanda_empty)
  test.fixme("não permite fechar uma comanda sem itens", async ({ page }) => {
    const operador = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
    // Pré-condição: comanda aberta e vazia (seed).
    await loginAs(page, operador);
    await page.goto("/pdv/COMANDA_VAZIA_SEED_ID");

    // Then: a ação de fechar não está disponível para comanda vazia
    await expect(page.getByRole("button", { name: /Fechar (comanda|e pagar)/i })).toBeDisabled();
  });

  // Integração PDV↔CAD-02 — o estoque só é debitado no FECHAMENTO (não no lançamento)
  test.fixme("debita o estoque dos produtos no fechamento da comanda", async ({ page }) => {
    const admin = await seedArenaUser({ role: "admin", modulesAllowed: ["pdv", "cadastros"] });
    // Pré-condição: produto "Água" com estoque 10; comanda com 3 unidades (seed).
    await loginAs(page, admin);
    await page.goto("/pdv/COMANDA_SEED_ID");

    await page.getByRole("button", { name: /Fechar (comanda|e pagar)/i }).click();
    await page.getByLabel(/Meio de Pagamento/i).selectOption({ label: "Pix" });
    await page.getByLabel(/Valor/i).first().fill("70,00");
    await page.getByRole("button", { name: "Finalizar e Fechar Comanda" }).click();
    await expect(page).toHaveURL(/\/pdv$/);

    // Then: o estoque do produto caiu de 10 para 7
    await page.goto("/admin/produtos");
    await expect(page.getByRole("row", { name: /Água/ })).toContainText("7");
  });
});
