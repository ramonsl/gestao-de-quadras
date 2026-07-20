import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test.describe("CAD-02: Cadastro de Produtos", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/produtos`);
  });

  test("AC 1: Criar novo produto", async ({ page }) => {
    await page.click("button:has-text('Novo Produto')");
    await page.fill('input[name="name"]', "Refrigerante");
    await page.fill('input[name="salePriceCents"]', "5,00");
    await page.selectOption('select[name="category"]', "bebidas");
    await page.fill('input[name="currentStock"]', "100");
    await page.fill('input[name="minStock"]', "10");
    await page.click("button:has-text('Criar')");
    await expect(page.locator("text=Refrigerante")).toBeVisible();
  });

  test("AC 2: Editar preço", async ({ page }) => {
    const name = "Suco";
    await page.click("button:has-text('Novo Produto')");
    await page.fill('input[name="name"]', name);
    await page.fill('input[name="salePriceCents"]', "8,00");
    await page.selectOption('select[name="category"]', "bebidas");
    await page.click("button:has-text('Criar')");

    await page.locator(`tr:has-text("${name}") button:has-text("Edit")`).click();
    await page.fill('input[name="salePriceCents"]', "9,50");
    await page.click("button:has-text('Atualizar')");
    await expect(page.locator("text=9,50")).toBeVisible();
  });

  test("AC 3: Alerta de estoque baixo", async ({ page }) => {
    const name = "Cerveja";
    await page.click("button:has-text('Novo Produto')");
    await page.fill('input[name="name"]', name);
    await page.fill('input[name="salePriceCents"]', "12,00");
    await page.selectOption('select[name="category"]', "bebidas");
    await page.fill('input[name="currentStock"]', "5");
    await page.fill('input[name="minStock"]', "10");
    await page.click("button:has-text('Criar')");

    await expect(page.locator("text=/com estoque baixo/")).toBeVisible();
    await expect(page.locator(`tr:has-text("${name}")`)).toHaveClass(/bg-red-50/);
  });

  test("AC 4: Filtrar por categoria", async ({ page }) => {
    for (const [name, cat] of [
      ["Coca", "bebidas"],
      ["Salgado", "lanches"],
    ]) {
      await page.click("button:has-text('Novo Produto')");
      await page.fill('input[name="name"]', name);
      await page.fill('input[name="salePriceCents"]', "5,00");
      await page.selectOption('select[name="category"]', cat);
      await page.click("button:has-text('Criar')");
    }

    await page.selectOption('select[name="category"]', "bebidas");
    await expect(page.locator("text=Coca")).toBeVisible();
    await expect(page.locator("text=Salgado")).not.toBeVisible();
  });

  test("AC 5: Validações", async ({ page }) => {
    await page.click("button:has-text('Novo Produto')");
    await page.click("button:has-text('Criar')");
    await expect(page.locator("text=/obrigatório/i")).toBeVisible();
  });

  test("AC 6: Deletar produto", async ({ page }) => {
    const name = "Deletável";
    await page.click("button:has-text('Novo Produto')");
    await page.fill('input[name="name"]', name);
    await page.fill('input[name="salePriceCents"]', "5,00");
    await page.selectOption('select[name="category"]', "lanches");
    await page.click("button:has-text('Criar')");

    page.on("dialog", (d) => d.accept());
    await page.locator(`tr:has-text("${name}") button[variant="destructive"]`).click();
    await expect(page.locator(`text=${name}`)).not.toBeVisible();
  });
});
