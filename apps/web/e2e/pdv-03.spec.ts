import { test, expect, loginAs, seedArenaUser } from "./fixtures";

/**
 * PDV-03 — Lançamento de Venda Balcão (Sem Identificação).
 *
 * Cada AC vira um caminho de ponta a ponta (Given/When/Then).
 *
 * ⚠️ Marcados como `test.fixme`: exigem um ambiente com servidor Next + Postgres
 * de teste e uma factory de seed de tenant/operador/cliente (ver
 * fixtures.seedArenaUser). Assim que o seed e o banco de teste estiverem
 * disponíveis, remover o `.fixme`. Convenções: sem sleeps fixos (usar expects
 * com auto-wait); sem snapshot de UI como única asserção; dados criados por
 * factory de seed, nunca herdados de outro teste.
 */

test.describe("PDV-03 — Venda balcão (sem identificação)", () => {
  // AC1 — abre venda balcão sem vincular cliente
  test.fixme("abre uma venda balcão sem identificar nenhum cliente", async ({ page }) => {
    const operador = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
    await loginAs(page, operador);

    await page.goto("/pdv");
    await page.getByRole("button", { name: "Venda balcão (sem identificação)" }).click();

    await expect(page).toHaveURL(/\/pdv\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "Venda Balcão" })).toBeVisible();
    // sem cliente vinculado, a tela oferece vincular depois — não bloqueia o atendimento
    await expect(page.getByRole("button", { name: "Vincular cliente" })).toBeVisible();
  });

  // AC2 — venda balcão não gera pontos nem notificação (pontos/WhatsApp são fases
  // futuras — PTS-01/WPP-02; aqui confirmamos que a tela não exige/expõe
  // identificação para operar, coerente com "sem pontos, sem notificação")
  test.fixme("venda balcão opera sem exigir identificação do cliente", async ({ page }) => {
    const operador = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
    // Pré-condição: ao menos um produto cadastrado (CAD-02).
    await loginAs(page, operador);

    await page.goto("/pdv");
    await page.getByRole("button", { name: "Venda balcão (sem identificação)" }).click();
    await expect(page).toHaveURL(/\/pdv\/[^/]+$/);

    await page.getByRole("button", { name: "Adicionar" }).first().click();

    await expect(page.getByText("Total parcial")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Venda Balcão" })).toBeVisible();
  });

  // AC3 — conversão de balcão para identificada a qualquer momento antes do fechamento
  test.fixme("converte a venda balcão em comanda identificada vinculando um cliente", async ({ page }) => {
    const operador = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
    // Pré-condição: cliente "Roberto Cliente" já cadastrado nesta arena.
    await loginAs(page, operador);

    await page.goto("/pdv");
    await page.getByRole("button", { name: "Venda balcão (sem identificação)" }).click();
    await expect(page).toHaveURL(/\/pdv\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "Venda Balcão" })).toBeVisible();

    await page.getByRole("button", { name: "Vincular cliente" }).click();
    await page
      .getByRole("dialog", { name: "Vincular cliente" })
      .getByPlaceholder(/buscar por nome ou whatsapp/i)
      .fill("roberto");
    await page.getByText("Roberto Cliente").click();

    await expect(page.getByRole("heading", { name: "Roberto Cliente" })).toBeVisible();
    // depois de identificada, some a ação de vincular (comanda já tem cliente)
    await expect(page.getByRole("button", { name: "Vincular cliente" })).toHaveCount(0);
  });

  // Os três caminhos de abertura (busca, cadastro rápido, balcão) coexistem na mesma tela
  test.fixme("os três caminhos de abertura de comanda coexistem na mesma tela do PDV", async ({ page }) => {
    const operador = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
    // Pré-condição: cliente "Camila Cadastrada" já existe nesta arena.
    await loginAs(page, operador);

    // Caminho 1: busca de cliente existente
    await page.goto("/pdv");
    await expect(page.getByRole("button", { name: "Cadastrar cliente novo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Venda balcão (sem identificação)" })).toBeVisible();
    await page.getByPlaceholder(/buscar por nome ou whatsapp/i).fill("camila");
    await page.getByText("Camila Cadastrada").click();
    await expect(page).toHaveURL(/\/pdv\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "Camila Cadastrada" })).toBeVisible();

    // Caminho 2: cadastro rápido de cliente novo
    await page.goto("/pdv");
    await page.getByRole("button", { name: "Cadastrar cliente novo" }).click();
    await page.getByLabel("Nome *").fill("Cliente Via Cadastro Rápido");
    await page.getByPlaceholder("(51) 99999-8888").fill("11933332222");
    await page.getByRole("button", { name: "Cadastrar" }).click();
    await expect(page).toHaveURL(/\/pdv\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "Cliente Via Cadastro Rápido" })).toBeVisible();

    // Caminho 3: venda balcão/anônima
    await page.goto("/pdv");
    await page.getByRole("button", { name: "Venda balcão (sem identificação)" }).click();
    await expect(page).toHaveURL(/\/pdv\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "Venda Balcão" })).toBeVisible();
  });

  // Isolamento — tenant B não acessa, nem por URL direta, a comanda balcão do tenant A
  test.fixme("Isolamento: tenant B não consegue abrir a comanda balcão do tenant A pelo ID direto na URL", async ({
    page,
  }) => {
    const adminA = await seedArenaUser({ role: "admin", tenantSlug: "arena-a" });
    await loginAs(page, adminA);
    await page.goto("/pdv");
    await page.getByRole("button", { name: "Venda balcão (sem identificação)" }).click();
    await expect(page).toHaveURL(/\/pdv\/[^/]+$/);
    const comandaUrl = page.url();
    await page.getByRole("button", { name: /sair|logout/i }).click();

    const adminB = await seedArenaUser({ role: "admin", tenantSlug: "arena-b" });
    await loginAs(page, adminB);
    await page.goto(comandaUrl); // tenta acessar a comanda do tenant A por IDOR direto

    await expect(page.getByText(/página não encontrada|not found|404/i)).toBeVisible();
  });
});
