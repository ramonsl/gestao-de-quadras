import { test, expect, loginAs, seedArenaUser } from "./fixtures";

/**
 * PUB-01 — Cadastro de Espaços Publicitários e Anunciantes.
 *
 * ACs (docs/spec/e7-publicidade.md, PUB-01):
 *  - Espaço Publicitário: identificação, tipo, status e valor de referência.
 *  - Anunciante: razão social/nome, CNPJ/CPF, e-mail e telefone do financeiro.
 *
 * Acesso: admin + gerente (módulo `publicidade`). A lógica dos serviços tem
 * cobertura unitária em `packages/core/src/publicidade/*.test.ts`.
 *
 * ⚠️ `test.fixme`: exigem Postgres de teste + seed de tenant/operador
 * (fixtures.seedArenaUser). Convenções: sem sleeps fixos; dados por factory de
 * seed; valores em centavos no back, reais na UI.
 */

test.describe("PUB-01 — Espaços publicitários", () => {
  test.fixme("admin cadastra um espaço publicitário e ele aparece na listagem", async ({ page }) => {
    const admin = await seedArenaUser({ role: "admin", modulesAllowed: ["publicidade"] });
    await loginAs(page, admin);

    await page.goto("/admin/publicidade/espacos");
    await page.getByRole("link", { name: "Novo espaço" }).click();

    await page.getByLabel(/Identificação/i).fill("Placa 1 - Fundo da Quadra 1");
    await page.getByLabel(/Tipo/i).selectOption("placa_fisica");
    await page.getByLabel(/Status/i).selectOption("disponivel");
    await page.getByLabel(/Valor de referência/i).fill("300,00");
    await page.getByRole("button", { name: "Criar espaço" }).click();

    await expect(page).toHaveURL(/\/admin\/publicidade\/espacos$/);
    await expect(page.getByRole("cell", { name: "Placa 1 - Fundo da Quadra 1" })).toBeVisible();
    await expect(page.getByText("Disponível")).toBeVisible();
    await expect(page.getByText(/R\$\s*300,00/)).toBeVisible();
  });

  test.fixme("gerente edita o status do espaço para manutenção", async ({ page }) => {
    const gerente = await seedArenaUser({ role: "gerente", modulesAllowed: ["publicidade"] });
    // Pré-condição: um espaço "Placa 1" já cadastrado (seed).
    await loginAs(page, gerente);

    await page.goto("/admin/publicidade/espacos");
    await page.getByRole("link", { name: "Editar" }).first().click();
    await page.getByLabel(/Status/i).selectOption("manutencao");
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Manutenção")).toBeVisible();
  });

  test.fixme("atendente não acessa o cadastro de publicidade (admin/gerente apenas)", async ({ page }) => {
    const atendente = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
    await loginAs(page, atendente);

    await page.goto("/admin/publicidade/espacos");
    await expect(page).toHaveURL(/\/negado/);
  });
});

test.describe("PUB-01 — Anunciantes", () => {
  test.fixme("admin cadastra um anunciante com CNPJ e ele aparece na listagem", async ({ page }) => {
    const admin = await seedArenaUser({ role: "admin", modulesAllowed: ["publicidade"] });
    await loginAs(page, admin);

    await page.goto("/admin/publicidade/anunciantes");
    await page.getByRole("link", { name: "Novo anunciante" }).click();

    await page.getByLabel(/Razão social/i).fill("Padel Store LTDA");
    await page.getByLabel(/CNPJ \/ CPF/i).fill("12.345.678/0001-99"); // com máscara → normaliza p/ dígitos
    await page.getByLabel(/E-mail/i).fill("financeiro@padelstore.com");
    await page.getByLabel(/Telefone/i).fill("+5551999999999");
    await page.getByRole("button", { name: "Criar anunciante" }).click();

    await expect(page).toHaveURL(/\/admin\/publicidade\/anunciantes$/);
    await expect(page.getByRole("cell", { name: "Padel Store LTDA" })).toBeVisible();
    // documento exibido formatado a partir dos dígitos armazenados
    await expect(page.getByText("12.345.678/0001-99")).toBeVisible();
  });

  test.fixme("rejeita documento inválido (nem CPF nem CNPJ)", async ({ page }) => {
    const admin = await seedArenaUser({ role: "admin", modulesAllowed: ["publicidade"] });
    await loginAs(page, admin);

    await page.goto("/admin/publicidade/anunciantes/novo");
    await page.getByLabel(/Razão social/i).fill("Empresa X");
    await page.getByLabel(/CNPJ \/ CPF/i).fill("123");
    await page.getByRole("button", { name: "Criar anunciante" }).click();

    await expect(page.getByText(/CPF \(11 dígitos\) ou CNPJ \(14 dígitos\)/i)).toBeVisible();
    await expect(page).toHaveURL(/\/anunciantes\/novo$/);
  });

  test.fixme("bloqueia CNPJ/CPF duplicado na mesma arena", async ({ page }) => {
    const admin = await seedArenaUser({ role: "admin", modulesAllowed: ["publicidade"] });
    // Pré-condição: já existe anunciante com o documento 12345678000199 (seed).
    await loginAs(page, admin);

    await page.goto("/admin/publicidade/anunciantes/novo");
    await page.getByLabel(/Razão social/i).fill("Outra Empresa");
    await page.getByLabel(/CNPJ \/ CPF/i).fill("12345678000199");
    await page.getByRole("button", { name: "Criar anunciante" }).click();

    await expect(page.getByText(/Já existe um anunciante com este CNPJ\/CPF/i)).toBeVisible();
  });
});
