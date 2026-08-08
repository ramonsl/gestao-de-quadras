import { test, expect, loginAs, seedArenaUser } from "./fixtures";

/**
 * PDV-08 — Resgate de Pontos como Meio de Pagamento no PDV
 *
 * Cada bloco de teste deriva dos Critérios de Aceite da spec (docs/spec/e3-pdv.md, PDV-08).
 *
 * ⚠️ Marcados como `test.fixme`: exigem servidor Next + Postgres de teste e a
 * factory de seed de tenant/operador (ver fixtures.seedArenaUser). A cobertura
 * unitária das regras de saldo, conversão e limites existe em
 * `packages/core/src/points/points.service.test.ts` e `packages/core/src/pdv/comanda.service.test.ts`.
 */

test.describe("PDV-08 — Resgate de Pontos como meio de pagamento", () => {
  // AC1 — Opção só fica visível/disponível se o programa de pontos estiver ativo e o cliente for identificado
  test.fixme(
    "exibe saldo e limite de resgate em pontos ao fechar comanda com cliente identificado",
    async ({ page }) => {
      const operador = await seedArenaUser({ role: "gerente", modulesAllowed: ["pdv"] });
      // Pré-condição: caixa aberto + comanda com cliente "Maria" que possui 500 pontos acumulados.
      await loginAs(page, operador);
      await page.goto("/pdv");

      // When: abre comanda e clica em Fechar Comanda
      await page.getByText("Maria").click();
      await page.getByRole("button", { name: /Fechar Comanda/i }).click();

      // And: seleciona forma de pagamento "Pontos / Cashback"
      await page.getByRole("combobox").selectOption("pontos");

      // Then: exibe o saldo de pontos e o limite permitido para resgate
      await expect(page.getByText(/Saldo do Cliente: 500 pts/i)).toBeVisible();
      await expect(page.getByText(/Limite de Resgate nesta Comanda/i)).toBeVisible();
    }
  );

  // AC1 — Comanda balcão (sem cliente) não permite resgate de pontos
  test.fixme(
    "alerta que resgate de pontos exige cliente identificado em venda balcão",
    async ({ page }) => {
      const operador = await seedArenaUser({ role: "gerente", modulesAllowed: ["pdv"] });
      // Pré-condição: caixa aberto + comanda balcão (sem cliente).
      await loginAs(page, operador);
      await page.goto("/pdv");

      await page.getByText(/Venda Balcão/i).click();
      await page.getByRole("button", { name: /Fechar Comanda/i }).click();
      await page.getByRole("combobox").selectOption("pontos");

      // Then: aviso visual informando que o resgate exige cliente identificado
      await expect(
        page.getByText(/resgate de pontos só está disponível para comandas com cliente identificado/i)
      ).toBeVisible();
    }
  );

  // AC1 — Programa de pontos desativado na arena bloqueia a opção de resgate
  test.fixme(
    "informa que o programa está desativado quando a arena não possui pontos ativos",
    async ({ page }) => {
      const operador = await seedArenaUser({ role: "gerente", modulesAllowed: ["pdv"] });
      // Pré-condição: programa de pontos desativado nas configurações da arena (points_settings.enabled = false).
      await loginAs(page, operador);
      await page.goto("/pdv");

      await page.getByText("Maria").click();
      await page.getByRole("button", { name: /Fechar Comanda/i }).click();
      await page.getByRole("combobox").selectOption("pontos");

      // Then: aviso visual informando que o programa de pontos está desativado
      await expect(
        page.getByText(/programa de pontos está desativado nas configurações desta arena/i)
      ).toBeVisible();
    }
  );

  // AC2 — Valida saldo disponível e converte em valor monetário ao concluir o pagamento
  test.fixme(
    "permite pagar parte da comanda com pontos e o restante em Pix",
    async ({ page }) => {
      const operador = await seedArenaUser({ role: "gerente", modulesAllowed: ["pdv"] });
      // Pré-condição: comanda de R$ 50,00 com cliente que possui R$ 20,00 em pontos (2000 pts).
      await loginAs(page, operador);
      await page.goto("/pdv");

      await page.getByText("Maria").click();
      await page.getByRole("button", { name: /Fechar Comanda/i }).click();

      // Forma 1: R$ 20,00 em Pontos
      await page.getByRole("combobox").first().selectOption("pontos");
      await page.getByPlaceholder("0,00").first().fill("20,00");

      // Forma 2: R$ 30,00 em Pix
      await page.getByRole("button", { name: /\+ Dividir/i }).click();
      await page.getByRole("combobox").nth(1).selectOption("pix");
      await page.getByPlaceholder("0,00").nth(1).fill("30,00");

      // When: confirma o fechamento
      await page.getByRole("button", { name: /Finalizar e Fechar Comanda/i }).click();

      // Then: comanda é fechada com sucesso
      await expect(page.getByText(/Comanda Fechada|Nenhum item/i)).toBeVisible();
    }
  );

  // AC3 — Tentativa de resgate acima do saldo ou limite é rejeitada pelo backend
  test.fixme(
    "exibe erro de saldo de pontos insuficiente se o operador tentar resgatar valor maior",
    async ({ page }) => {
      const operador = await seedArenaUser({ role: "gerente", modulesAllowed: ["pdv"] });
      // Pré-condição: cliente tem apenas R$ 5,00 em pontos.
      await loginAs(page, operador);
      await page.goto("/pdv");

      await page.getByText("Maria").click();
      await page.getByRole("button", { name: /Fechar Comanda/i }).click();

      await page.getByRole("combobox").selectOption("pontos");
      await page.getByPlaceholder("0,00").fill("50,00"); // Tenta resgatar R$ 50,00

      await page.getByRole("button", { name: /Finalizar e Fechar Comanda/i }).click();

      // Then: alerta de erro exibido na tela
      await expect(
        page.getByText(/não possui saldo de pontos suficiente|excede o limite máximo/i)
      ).toBeVisible();
    }
  );
});
