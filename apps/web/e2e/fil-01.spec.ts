import { expect, loginAs, seedArenaUser, test } from "./fixtures";

test.describe("FIL-01 — Planos e filiações", () => {
  test("Admin acessa a gestão e vê os formulários de plano e vínculo", async ({ page }) => {
    await loginAs(page, await seedArenaUser({ role: "admin" }));
    await page.goto("/admin/filiacao");
    await expect(page.getByRole("heading", { name: "Planos e filiações" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Criar plano" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Vincular cliente" })).toBeVisible();
  });

  test("Gerente não acessa a gestão exclusiva do Admin", async ({ page }) => {
    await loginAs(page, await seedArenaUser({ role: "gerente" }));
    await page.goto("/admin/filiacao");
    await expect(page).toHaveURL(/\/usuarios\/negado|\/login/);
  });

  test("valida os campos obrigatórios e limites do plano", async ({ page }) => {
    await loginAs(page, await seedArenaUser({ role: "admin" }));
    await page.goto("/admin/filiacao");
    await page.getByLabel("Nome").first().fill("Plano inválido");
    await page.getByLabel("Descrição").first().fill("Teste de validação");
    await page.getByLabel("Valor do ciclo (centavos)").first().fill("0");
    await page.getByLabel("Desconto em produtos (%)").first().fill("101");
    await page.getByRole("button", { name: "Criar plano" }).click();
    await expect(page.getByLabel("Valor do ciclo (centavos)").first()).toBeFocused();
  });

  test("PDV exibe prévia de benefício antes de fechar", async ({ page }) => {
    await loginAs(page, await seedArenaUser({ role: "admin", modulesAllowed: ["pdv"] }));
    await page.goto("/pdv");
    const firstComanda = page.getByRole("link", { name: /comanda/i }).first();
    await firstComanda.click();
    await page.getByRole("button", { name: /fechar comanda/i }).click();
    await expect(page.getByText(/Total da Comanda/i)).toBeVisible();
  });
});
