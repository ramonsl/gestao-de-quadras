import { test, expect, loginAs, seedArenaUser } from "./fixtures";

/**
 * PDV-02 — Lançamento de Itens em Comanda Identificada (inclui o cadastro
 * rápido inline de cliente e o snapshot de preço no lançamento).
 *
 * Cada AC vira um caminho de ponta a ponta (Given/When/Then).
 *
 * ⚠️ Marcados como `test.fixme`: exigem um ambiente com servidor Next + Postgres
 * de teste e uma factory de seed de tenant/operador/cliente/produto (ver
 * fixtures.seedArenaUser — hoje só cobre operador; seed de cliente/produto de
 * teste ainda não existe no ambiente). Assim que o seed e o banco de teste
 * estiverem disponíveis, remover o `.fixme`. Convenções: sem sleeps fixos (usar
 * expects com auto-wait); sem snapshot de UI como única asserção; dados
 * criados por factory de seed, nunca herdados de outro teste.
 *
 * Cadastro rápido com WhatsApp já global (de outra arena): a tela mostra uma
 * prévia inline dos dados encontrados (nome/e-mail) assim que o WhatsApp é
 * digitado por completo — ver docs/spec/e3-pdv.md, passo 4 do roteiro de QA —
 * e o próprio clique em "Cadastrar" já confirma, sem um segundo diálogo.
 */

test.describe("PDV-02 — Lançamento de itens em comanda identificada", () => {
  // AC1 — busca e vincula cliente já cadastrado
  test.fixme("busca cliente existente por nome e abre a comanda já identificada", async ({ page }) => {
    const operador = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
    // Pré-condição: cliente "Maria Silva" já cadastrado nesta arena.
    await loginAs(page, operador);

    await page.goto("/pdv");
    await page.getByPlaceholder(/buscar por nome ou whatsapp/i).fill("maria");
    await expect(page.getByText("Maria Silva")).toBeVisible();

    await page.getByText("Maria Silva").click();

    await expect(page).toHaveURL(/\/pdv\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "Maria Silva" })).toBeVisible();
  });

  // AC1 — busca sem resultado oferece o cadastro rápido, sem sair da tela do PDV
  test.fixme("busca sem resultado exibe a opção de cadastro rápido, sem sair do PDV", async ({ page }) => {
    const operador = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
    await loginAs(page, operador);

    await page.goto("/pdv");
    await page.getByPlaceholder(/buscar por nome ou whatsapp/i).fill("ninguem-com-este-nome-xyz");

    await expect(page.getByText("Nenhum cliente encontrado.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cadastrar novo cliente" })).toBeVisible();
    await expect(page).toHaveURL(/\/pdv$/);
  });

  // Cadastro Rápido — WhatsApp inédito: cria global + local e já vincula à comanda
  test.fixme("cadastro rápido com WhatsApp inédito cria o cliente e abre a comanda vinculada", async ({ page }) => {
    const operador = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
    await loginAs(page, operador);

    await page.goto("/pdv");
    await page.getByRole("button", { name: "Cadastrar cliente novo" }).click();

    await expect(page.getByRole("dialog", { name: "Cadastrar cliente" })).toBeVisible();
    await page.getByLabel("Nome *").fill("Fernanda Nova");
    await page.getByPlaceholder("(51) 99999-8888").fill("11988887777");
    await page.getByRole("button", { name: "Cadastrar" }).click();

    // comanda aberta e já identificada com o cliente recém-criado
    await expect(page).toHaveURL(/\/pdv\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "Fernanda Nova" })).toBeVisible();
  });

  // Cadastro Rápido — WhatsApp já em global_customers de OUTRA arena: reaproveita os dados
  test.fixme(
    "cadastro rápido com WhatsApp já global (de outra arena) reaproveita nome/e-mail/nascimento",
    async ({ page }) => {
      const adminA = await seedArenaUser({ role: "admin", tenantSlug: "arena-a" });
      await loginAs(page, adminA);
      await page.goto("/pdv");
      await page.getByRole("button", { name: "Cadastrar cliente novo" }).click();
      await page.getByLabel("Nome *").fill("Cadastro Original Arena A");
      await page.getByPlaceholder("(51) 99999-8888").fill("11977776666");
      await page.getByRole("button", { name: "Cadastrar" }).click();
      await expect(page).toHaveURL(/\/pdv\/[^/]+$/);
      await page.getByRole("button", { name: /sair|logout/i }).click();

      const adminB = await seedArenaUser({ role: "admin", tenantSlug: "arena-b" });
      await loginAs(page, adminB);
      await page.goto("/pdv");
      await page.getByRole("button", { name: "Cadastrar cliente novo" }).click();
      await page.getByLabel("Nome *").fill("Nome Que Deveria Ser Ignorado");
      await page.getByPlaceholder("(51) 99999-8888").fill("11977776666"); // mesmo WhatsApp da arena A

      // Prévia inline aparece ANTES de submeter (passo 4 do roteiro de QA).
      await expect(page.getByText(/já existe um cadastro global/i)).toBeVisible();
      await expect(page.getByText("Cadastro Original Arena A")).toBeVisible();

      await page.getByRole("button", { name: "Cadastrar" }).click();

      // o nome que prevalece é o do cadastro GLOBAL (arena A), não o texto digitado agora
      await expect(page).toHaveURL(/\/pdv\/[^/]+$/);
      await expect(page.getByRole("heading", { name: "Cadastro Original Arena A" })).toBeVisible();
    }
  );

  // Opt-in LGPD é solicitado durante o cadastro rápido
  test.fixme("cadastro rápido solicita o opt-in de WhatsApp (LGPD) e respeita a escolha do operador", async ({
    page,
  }) => {
    const operador = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
    await loginAs(page, operador);

    await page.goto("/pdv");
    await page.getByRole("button", { name: "Cadastrar cliente novo" }).click();

    const optInCheckbox = page.getByLabel(/autoriza receber mensagens/i);
    await expect(optInCheckbox).toBeChecked(); // nasce marcado por padrão na tela
    await optInCheckbox.uncheck();

    await page.getByLabel("Nome *").fill("Cliente Sem Optin");
    await page.getByPlaceholder("(51) 99999-8888").fill("11966665555");
    await page.getByRole("button", { name: "Cadastrar" }).click();

    // A persistência do opt-in por arena (customer_opt_in_lgpd) é coberta a
    // nível de unidade em packages/core/src/customers/customer.service.test.ts
    // (describe "setCustomerOptIn"); a tela de Clientes ainda não expõe o
    // status de consentimento visualmente hoje — daí este teste não tentar
    // reabrir o cliente para conferir lá.
    await expect(page).toHaveURL(/\/pdv\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "Cliente Sem Optin" })).toBeVisible();
  });

  // Caso de borda — cancelar o cadastro rápido no meio do preenchimento
  test.fixme("cancelar o cadastro rápido mantém a tela do PDV disponível, sem travar", async ({ page }) => {
    const operador = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
    await loginAs(page, operador);

    await page.goto("/pdv");
    await page.getByRole("button", { name: "Cadastrar cliente novo" }).click();
    await page.getByLabel("Nome *").fill("Desistiu No Meio");
    await page.getByRole("button", { name: "Cancelar" }).click();

    await expect(page.getByRole("dialog", { name: "Cadastrar cliente" })).not.toBeVisible();
    // a tela do PDV segue disponível — pode tentar a busca de novo ou seguir balcão
    await expect(page.getByRole("heading", { name: "Nova comanda" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Venda balcão (sem identificação)" })).toBeVisible();
  });

  // Caso de borda — validação de campos obrigatórios do cadastro rápido
  test.fixme("bloqueia o cadastro rápido com o nome em branco", async ({ page }) => {
    const operador = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
    await loginAs(page, operador);

    await page.goto("/pdv");
    await page.getByRole("button", { name: "Cadastrar cliente novo" }).click();
    await page.getByPlaceholder("(51) 99999-8888").fill("11955554444");
    await page.getByRole("button", { name: "Cadastrar" }).click();

    await expect(page.getByText(/nome.*obrigatóri/i)).toBeVisible();
  });

  test.fixme("bloqueia o cadastro rápido com WhatsApp em formato inválido", async ({ page }) => {
    const operador = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
    await loginAs(page, operador);

    await page.goto("/pdv");
    await page.getByRole("button", { name: "Cadastrar cliente novo" }).click();
    await page.getByLabel("Nome *").fill("WhatsApp Incompleto");
    await page.getByPlaceholder("(51) 99999-8888").fill("119"); // número incompleto
    await page.getByRole("button", { name: "Cadastrar" }).click();

    await expect(page.getByText(/whatsapp.*inválido/i)).toBeVisible();
  });

  // AC4 (snapshot de preço, regra 10 CLAUDE.md) — o lançamento grava o preço vigente
  test.fixme("lançamento de item exibe e grava o preço vigente do produto (snapshot)", async ({ page }) => {
    const operador = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
    // Pré-condição: produto "Água Mineral 500ml" cadastrado a R$ 5,00 (CAD-02).
    // A garantia de que uma alteração POSTERIOR no catálogo nunca altera um
    // item já lançado é coberta exaustivamente a nível de unidade em
    // packages/core/src/pdv/comanda.service.test.ts ("snapshot é imutável");
    // aqui validamos o comportamento observável na tela no momento do lançamento.
    await loginAs(page, operador);

    await page.goto("/pdv");
    await page.getByRole("button", { name: "Venda balcão (sem identificação)" }).click();
    await expect(page).toHaveURL(/\/pdv\/[^/]+$/);

    await page.getByRole("button", { name: "Adicionar" }).first().click();

    await expect(page.getByText("Água Mineral 500ml")).toBeVisible();
    await expect(page.getByRole("cell", { name: "R$ 5,00" }).first()).toBeVisible();
    await expect(page.getByText("Total parcial")).toBeVisible();
  });

  // Isolamento — tenant B não enxerga, na busca, um cliente cadastrado via PDV pelo tenant A
  test.fixme(
    "Isolamento: tenant B não encontra na busca um cliente cadastrado via PDV pelo tenant A",
    async ({ page }) => {
      const adminA = await seedArenaUser({ role: "admin", tenantSlug: "arena-a" });
      await loginAs(page, adminA);
      await page.goto("/pdv");
      await page.getByRole("button", { name: "Cadastrar cliente novo" }).click();
      await page.getByLabel("Nome *").fill("Só Existe Na Arena A");
      await page.getByPlaceholder("(51) 99999-8888").fill("11944443333");
      await page.getByRole("button", { name: "Cadastrar" }).click();
      await expect(page).toHaveURL(/\/pdv\/[^/]+$/);
      await page.getByRole("button", { name: /sair|logout/i }).click();

      const adminB = await seedArenaUser({ role: "admin", tenantSlug: "arena-b" });
      await loginAs(page, adminB);
      await page.goto("/pdv");
      await page.getByPlaceholder(/buscar por nome ou whatsapp/i).fill("Só Existe Na Arena A");

      await expect(page.getByText("Nenhum cliente encontrado.")).toBeVisible();
      await expect(page.getByText("Só Existe Na Arena A")).toHaveCount(0);
    }
  );
});
