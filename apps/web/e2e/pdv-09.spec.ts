import { test, expect, loginAs, seedArenaUser } from "./fixtures";

/**
 * PDV-09 — Controle de Cancelamentos, Estornos e Correções no PDV
 */

async function openComandaAndEnsureItem(page: any) {
  await page.goto("/pdv");
  await page.getByText(/Maria Oliveira|Venda Balcão/i).first().click();
  await page.waitForURL(/\/pdv\/[a-z0-9-]+/);

  if (await page.getByText("Nenhum item lançado ainda.").isVisible()) {
    await page.getByRole("button", { name: "Lançar Itens" }).click();
    await page.getByText(/Heineken|Água|Coca|Red Bull/i).first().click();
    await page.getByRole("button", { name: "Confirmar Lançamento" }).click();
    await expect(page.getByText("Nenhum item lançado ainda.")).not.toBeVisible();
  }
}

test.describe("PDV-09 — Controle de Cancelamentos e Estornos no PDV", () => {
  test(
    "permite cancelamento de item com justificativa quando operador é gerente ou admin",
    async ({ page }) => {
      const operador = await seedArenaUser({ role: "admin" });
      await loginAs(page, operador);
      await openComandaAndEnsureItem(page);

      // When: clica no botão de lixeira do item
      await page.getByTitle("Cancelar este item").first().click();

      // Then: abre o modal de cancelamento
      await expect(page.getByText("Cancelar Item da Comanda")).toBeVisible();

      // And: preenche justificativa válida (>= 5 caracteres)
      await page.getByLabel(/Justificativa do Cancelamento/i).fill("Cliente desistiu antes do consumo.");
      await page.getByRole("button", { name: /Confirmar Cancelamento/i }).click();

      // Then: modal fecha após o cancelamento
      await expect(page.getByText("Cancelar Item da Comanda")).not.toBeVisible();
    }
  );

  test(
    "exibe erro de validação se a justificativa for menor que 5 caracteres",
    async ({ page }) => {
      const operador = await seedArenaUser({ role: "admin" });
      await loginAs(page, operador);
      await openComandaAndEnsureItem(page);

      await page.getByTitle("Cancelar este item").first().click();

      // When: preenche justificativa curta (ex.: "Erro")
      await page.getByLabel(/Justificativa do Cancelamento/i).fill("Erro");

      // Then: botão de confirmação permanece desabilitado
      await expect(page.getByRole("button", { name: /Confirmar Cancelamento/i })).toBeDisabled();
    }
  );

  test(
    "exibe campo de senha de supervisor quando o operador logado é atendente",
    async ({ page }) => {
      const atendente = await seedArenaUser({ role: "atendente" });
      await loginAs(page, atendente);
      await openComandaAndEnsureItem(page);

      await page.getByTitle("Cancelar este item").first().click();

      // Then: exibe campo para digitação da senha do supervisor
      await expect(page.getByLabel(/Senha do Supervisor/i)).toBeVisible();
    }
  );
});
