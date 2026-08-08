import { test, expect, loginAs, seedArenaUser } from "./fixtures";

/**
 * PDV-04 — Controle de Comandas em Aberto (Visualização em Grade e Fluxo de Criação)
 *
 * Cada bloco de teste deriva de um Critério de Aceite da spec (docs/spec/e3-pdv.md, PDV-04).
 *
 * ⚠️ Marcados como `test.fixme`: exigem servidor Next + Postgres de teste e a
 * factory de seed de tenant/operador (ver fixtures.seedArenaUser). A cobertura
 * unitária de `listOpenComandas`, `openComanda` (unicidade) e `linkCustomerToComanda`
 * já existe em `packages/core/src/pdv/comanda.service.test.ts`.
 *
 * Convenções: sem sleeps fixos (expects com auto-wait); dados por factory de
 * seed, nunca herdados entre testes.
 */

test.describe("PDV-04 — Grade visual de comandas em aberto", () => {
  // AC1 — Grade exibe cards com as informações obrigatórias
  test.fixme(
    "exibe cards com nome do cliente, tempo transcorrido e valor total",
    async ({ page }) => {
      const operador = await seedArenaUser({ role: "gerente", modulesAllowed: ["pdv"] });
      // Pré-condição: caixa aberto + comanda identificada com itens (seed).
      await loginAs(page, operador);
      await page.goto("/pdv");

      // Then: pelo menos um card com nome, tempo e valor
      const card = page.locator('[data-testid="comanda-card"]').first();
      await expect(card).toBeVisible();
      await expect(card.getByText(/Maria/i)).toBeVisible();         // nome do cliente
      await expect(card.getByText(/há|min|h/i)).toBeVisible();      // tempo transcorrido
      await expect(card.getByText(/R\$\s*\d/)).toBeVisible();       // valor total
    }
  );

  // AC1 — Comanda balcão exibe "Venda Balcão"
  test.fixme("exibe 'Venda Balcão' para comandas sem cliente associado", async ({ page }) => {
    const operador = await seedArenaUser({ role: "gerente", modulesAllowed: ["pdv"] });
    // Pré-condição: comanda anônima em aberto (seed).
    await loginAs(page, operador);
    await page.goto("/pdv");

    await expect(page.getByText(/Venda Balcão/i)).toBeVisible();
  });

  // AC1 — Clicar no card navega para o detalhe da comanda
  test.fixme("clicar no card de comanda navega para o detalhe", async ({ page }) => {
    const operador = await seedArenaUser({ role: "gerente", modulesAllowed: ["pdv"] });
    // Pré-condição: ao menos uma comanda em aberto (seed).
    await loginAs(page, operador);
    await page.goto("/pdv");

    await page.locator('[data-testid="comanda-card"]').first().click();

    // Then: URL muda para /pdv/<uuid>
    await expect(page).toHaveURL(/\/pdv\/[0-9a-f-]{36}/);
  });

  // AC3 — FAB exibe as duas opções ao ser clicado
  test.fixme("FAB abre menu com 'Venda Balcão' e 'Identificar Cliente'", async ({ page }) => {
    const operador = await seedArenaUser({ role: "gerente", modulesAllowed: ["pdv"] });
    await loginAs(page, operador);
    await page.goto("/pdv");

    await page.getByRole("button", { name: /Nova Comanda/i }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("button", { name: /Venda Balcão/i })).toBeVisible();
    await expect(page.getByText(/Buscar Cliente/i)).toBeVisible();
  });

  // AC3 — Opção "Venda Balcão" cria comanda anônima e redireciona
  test.fixme(
    "selecionar 'Venda Balcão' cria comanda anônima e redireciona para o workspace",
    async ({ page }) => {
      const operador = await seedArenaUser({ role: "gerente", modulesAllowed: ["pdv"] });
      await loginAs(page, operador);
      await page.goto("/pdv");

      await page.getByRole("button", { name: /Nova Comanda/i }).click();
      await page.getByRole("button", { name: /Venda Balcão/i }).click();

      // Then: redireciona para /pdv/<uuid>
      await expect(page).toHaveURL(/\/pdv\/[0-9a-f-]{36}/);
    }
  );

  // AC3 — Buscar cliente existente cria comanda identificada e redireciona
  test.fixme(
    "buscar cliente existente no FAB cria comanda identificada e redireciona",
    async ({ page }) => {
      const operador = await seedArenaUser({ role: "gerente", modulesAllowed: ["pdv"] });
      // Pré-condição: cliente "João Silva" cadastrado sem comanda aberta (seed).
      await loginAs(page, operador);
      await page.goto("/pdv");

      await page.getByRole("button", { name: /Nova Comanda/i }).click();
      await page.getByPlaceholder(/Buscar/i).fill("João");
      await page.getByText("João Silva").click();

      // Then: redireciona para o workspace da comanda criada
      await expect(page).toHaveURL(/\/pdv\/[0-9a-f-]{36}/);
    }
  );

  // AC2 — Regra de unicidade: bloquear segunda comanda para o mesmo cliente
  test.fixme(
    "tentativa de abrir segunda comanda para o mesmo cliente exibe alerta com atalho",
    async ({ page }) => {
      const operador = await seedArenaUser({ role: "gerente", modulesAllowed: ["pdv"] });
      // Pré-condição: cliente "Maria Costa" já possui comanda aberta (seed).
      await loginAs(page, operador);
      await page.goto("/pdv");

      await page.getByRole("button", { name: /Nova Comanda/i }).click();
      await page.getByPlaceholder(/Buscar/i).fill("Maria");
      await page.getByText("Maria Costa").click();

      // Then: alerta de comanda existente + atalho "Ir para a comanda existente"
      await expect(page.getByText(/já possui uma comanda em aberto/i)).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Ir para a comanda existente/i })
      ).toBeVisible();
    }
  );

  // AC2 — Atalho "Ir para a comanda existente" navega para a comanda correta
  test.fixme(
    "clicar no atalho 'Ir para a comanda existente' navega para ela",
    async ({ page }) => {
      const operador = await seedArenaUser({ role: "gerente", modulesAllowed: ["pdv"] });
      // Pré-condição: cliente "Maria Costa" já possui comanda aberta (seed).
      await loginAs(page, operador);
      await page.goto("/pdv");

      await page.getByRole("button", { name: /Nova Comanda/i }).click();
      await page.getByPlaceholder(/Buscar/i).fill("Maria");
      await page.getByText("Maria Costa").click();
      await page.getByRole("button", { name: /Ir para a comanda existente/i }).click();

      // Then: redireciona para /pdv/<uuid> da comanda existente
      await expect(page).toHaveURL(/\/pdv\/[0-9a-f-]{36}/);
    }
  );

  // AC4 — Fechar caixa com comandas abertas exibe alerta informativo
  test.fixme(
    "fechar caixa com comandas abertas exibe alerta sobre pendentes",
    async ({ page }) => {
      const operador = await seedArenaUser({ role: "gerente", modulesAllowed: ["pdv"] });
      // Pré-condição: caixa aberto + 2 comandas em aberto (seed).
      await loginAs(page, operador);
      await page.goto("/pdv");

      await page.getByRole("button", { name: /Fechar Caixa/i }).click();

      // Then: o dialog exibe o aviso de comandas pendentes
      await expect(
        page.getByText(/comandas em aberto/i)
      ).toBeVisible();
      await expect(
        page.getByText(/permanecerão abertas para o próximo turno/i)
      ).toBeVisible();
    }
  );

  // AC4 — Fechar caixa sem comandas abertas não exibe alerta
  test.fixme(
    "fechar caixa sem comandas abertas não exibe alerta de pendentes",
    async ({ page }) => {
      const operador = await seedArenaUser({ role: "gerente", modulesAllowed: ["pdv"] });
      // Pré-condição: caixa aberto + nenhuma comanda em aberto (seed).
      await loginAs(page, operador);
      await page.goto("/pdv");

      await page.getByRole("button", { name: /Fechar Caixa/i }).click();

      // Then: o dialog não exibe aviso de pendentes
      await expect(
        page.getByText(/comandas em aberto/i)
      ).toBeHidden();
    }
  );
});
