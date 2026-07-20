import { test, expect, loginAs, seedArenaUser } from "./fixtures";

/**
 * SAAS-12 — Cadastro e Gestão de Usuários Operacionais da Arena (Issue #63).
 *
 * Cada AC vira um caminho de ponta a ponta (Given/When/Then).
 *
 * ⚠️ Marcados como `test.fixme`: exigem um ambiente com servidor Next + Postgres
 * de teste e uma factory de seed de tenant/operador (ver fixtures.seedArenaUser).
 * Assim que o seed e o banco de teste estiverem disponíveis, remover o `.fixme`.
 * Convenções: sem sleeps fixos (usar expects com auto-wait); sem snapshot de UI
 * como única asserção; dados criados por factory de seed, nunca herdados.
 */

test.describe("SAAS-12 — Gestão de usuários operacionais", () => {
  // AC2/AC "Login imediato" — criar operador COM senha e logar em seguida
  test.fixme("Admin cria operador local (sem e-mail) e ele loga imediatamente", async ({ page }) => {
    const admin = await seedArenaUser({ role: "admin" });
    await loginAs(page, admin);

    await page.goto("/usuarios/novo");
    await page.getByLabel("Nome completo").fill("Caixa Um");
    await page.getByLabel("Usuário (login)").fill("caixa01");
    await page.getByLabel("Senha inicial").fill("senhaForte1");
    await page.getByLabel(/PDV/i).check();
    await page.getByRole("button", { name: /salvar|criar/i }).click();

    await expect(page.getByRole("cell", { name: "caixa01" })).toBeVisible();

    // o operador recém-criado loga imediatamente com username + senha
    await page.getByRole("button", { name: /sair|logout/i }).click();
    await loginAs(page, { identifier: "caixa01", password: "senhaForte1" });
    await expect(page).toHaveURL(/\/pdv|\/usuarios|\/dashboard/);
  });

  // AC3 — login por e-mail
  test.fixme("Operador com e-mail loga usando o e-mail", async ({ page }) => {
    const admin = await seedArenaUser({ role: "admin" });
    await loginAs(page, admin);

    await page.goto("/usuarios/novo");
    await page.getByLabel("Nome completo").fill("Gerente Com Email");
    await page.getByLabel("Usuário (login)").fill("gerente01");
    await page.getByLabel("E-mail (opcional)").fill("gerente01@arena.com");
    await page.getByLabel("Senha inicial").fill("senhaForte1");
    await page.getByRole("button", { name: /salvar|criar/i }).click();

    await page.getByRole("button", { name: /sair|logout/i }).click();
    await loginAs(page, { identifier: "gerente01@arena.com", password: "senhaForte1" });
    await expect(page).not.toHaveURL(/\/login/);
  });

  // AC2 — validação de senha mínima (a UI usa 8; ver divergência com a spec no relatório)
  test.fixme("rejeita senha com menos de 8 caracteres", async ({ page }) => {
    const admin = await seedArenaUser({ role: "admin" });
    await loginAs(page, admin);

    await page.goto("/usuarios/novo");
    await page.getByLabel("Nome completo").fill("Curto");
    await page.getByLabel("Usuário (login)").fill("curto01");
    await page.getByLabel("Senha inicial").fill("curta12");
    await page.getByRole("button", { name: /salvar|criar/i }).click();

    await expect(page.getByText(/ao menos 8 caracteres|mínimo 8/i)).toBeVisible();
  });

  // AC4 — matriz granular de módulos e vigência no próximo login
  test.fixme("Admin altera módulos permitidos e a mudança bloqueia acesso não autorizado", async ({ page }) => {
    const admin = await seedArenaUser({ role: "admin" });
    const operador = await seedArenaUser({ username: "op-mods", role: "atendente", modulesAllowed: ["pdv"] });
    await loginAs(page, admin);

    await page.goto("/usuarios");
    await page.getByRole("row", { name: /op-mods/i }).getByRole("link", { name: /editar/i }).click();
    await page.getByLabel(/CRM/i).check();
    await page.getByRole("button", { name: /salvar/i }).click();
    await expect(page.getByRole("cell", { name: "op-mods" })).toBeVisible();

    // o operador passa a enxergar CRM no próximo login
    await page.getByRole("button", { name: /sair|logout/i }).click();
    await loginAs(page, operador);
    await expect(page.getByRole("link", { name: /CRM/i })).toBeVisible();
  });

  // AC "Inativação" + Autoproteção — não pode inativar o último admin
  test.fixme("bloqueia a inativação do último admin ativo (autoproteção)", async ({ page }) => {
    const admin = await seedArenaUser({ username: "unico-admin", role: "admin" });
    await loginAs(page, admin);

    await page.goto("/usuarios");
    await page.getByRole("row", { name: /unico-admin/i }).getByRole("button", { name: /inativar/i }).click();

    await expect(page.getByText(/último admin|ao menos um admin/i)).toBeVisible();
    await expect(page.getByRole("row", { name: /unico-admin/i }).getByText(/ativo/i)).toBeVisible();
  });

  // AC "Recuperação sem e-mail" — reset feito pelo Admin
  test.fixme("Admin redefine a senha de um operador sem e-mail", async ({ page }) => {
    const admin = await seedArenaUser({ role: "admin" });
    const operador = await seedArenaUser({ username: "sem-email", role: "atendente" });
    await loginAs(page, admin);

    await page.goto("/usuarios");
    await page.getByRole("row", { name: /sem-email/i }).getByRole("button", { name: /redefinir senha/i }).click();
    await page.getByLabel(/nova senha/i).fill("novaSenhaSegura1");
    await page.getByRole("button", { name: /confirmar|salvar/i }).click();
    await expect(page.getByText(/senha redefinida/i)).toBeVisible();

    await page.getByRole("button", { name: /sair|logout/i }).click();
    await loginAs(page, { identifier: operador.identifier, password: "novaSenhaSegura1" });
    await expect(page).not.toHaveURL(/\/login/);
  });

  // AC1 — Isolamento de tenant: tenant B não enxerga usuários do tenant A
  test.fixme("Isolamento: Admin do tenant B não vê operadores do tenant A", async ({ page }) => {
    const adminA = await seedArenaUser({ username: "admin-a", role: "admin", tenantSlug: "arena-a" });
    await seedArenaUser({ username: "so-do-a", role: "atendente", tenantSlug: "arena-a" });
    const adminB = await seedArenaUser({ username: "admin-b", role: "admin", tenantSlug: "arena-b" });

    // adminA enxerga o operador da sua arena
    await loginAs(page, adminA);
    await page.goto("/usuarios");
    await expect(page.getByRole("cell", { name: "so-do-a" })).toBeVisible();
    await page.getByRole("button", { name: /sair|logout/i }).click();

    // adminB (outro tenant) NÃO enxerga o operador do tenant A
    await loginAs(page, adminB);
    await page.goto("/usuarios");
    await expect(page.getByRole("cell", { name: "so-do-a" })).toHaveCount(0);
  });
});
