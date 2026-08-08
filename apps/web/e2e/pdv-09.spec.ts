import { test, expect, loginAs, seedArenaUser } from "./fixtures";

/**
 * PDV-09 — Controle de Cancelamentos, Estornos e Correções no PDV
 *
 * Cada bloco de teste deriva dos Critérios de Aceite da spec (docs/spec/e3-pdv.md, PDV-09).
 *
 * ⚠️ Marcados como `test.fixme`: exigem servidor Next + Postgres de teste e a
 * factory de seed de tenant/operador (ver fixtures.seedArenaUser). A cobertura
 * unitária da verificação de autorização e log de auditoria existe em
 * `packages/core/src/pdv/comanda.service.test.ts`.
 */

test.describe("PDV-09 — Controle de Cancelamentos e Estornos no PDV", () => {
  // AC1 — Exclusão de item de comanda exige permissão e justificativa
  test.fixme(
    "permite cancelamento de item com justificativa quando operador é gerente ou admin",
    async ({ page }) => {
      const operador = await seedArenaUser({ role: "gerente", modulesAllowed: ["pdv"] });
      // Pré-condição: comanda aberta com ao menos 1 item lançado
      await loginAs(page, operador);
      await page.goto("/pdv");

      await page.getByText("Maria").click();

      // When: clica no botão de lixeira do item
      await page.getByTitle("Cancelar este item").first().click();

      // Then: abre o modal de cancelamento
      await expect(page.getByText("Cancelar Item da Comanda")).toBeVisible();

      // And: preenche justificativa válida
      await page.getByLabel(/Justificativa do Cancelamento/i).fill("Cliente desistiu antes do consumo.");
      await page.getByRole("button", { name: /Confirmar Cancelamento/i }).click();

      // Then: item é removido da lista
      await expect(page.getByText("Cancelar Item da Comanda")).not.toBeVisible();
    }
  );

  // AC1 — Bloqueio de cancelamento com justificativa em branco ou muito curta
  test.fixme(
    "exibe erro de validação se a justificativa for menor que 5 caracteres",
    async ({ page }) => {
      const operador = await seedArenaUser({ role: "admin", modulesAllowed: ["pdv"] });
      await loginAs(page, operador);
      await page.goto("/pdv");

      await page.getByText("Maria").click();
      await page.getByTitle("Cancelar este item").first().click();

      // When: preenche justificativa curta (ex.: "Erro")
      await page.getByLabel(/Justificativa do Cancelamento/i).fill("Erro");

      // Then: botão de confirmação permanece desabilitado ou validação indica erro
      await expect(page.getByRole("button", { name: /Confirmar Cancelamento/i })).toBeDisabled();
    }
  );

  // AC1 — Atendente exige senha de supervisor para autorizar cancelamento
  test.fixme(
    "exibe campo de senha de supervisor quando o operador logado é atendente",
    async ({ page }) => {
      const atendente = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
      await loginAs(page, atendente);
      await page.goto("/pdv");

      await page.getByText("Maria").click();
      await page.getByTitle("Cancelar este item").first().click();

      // Then: exibe campo para digitação da senha do supervisor
      await expect(page.getByLabel(/Senha do Supervisor/i)).toBeVisible();
    }
  );
});
