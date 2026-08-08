import { test as base, expect, type Page } from "@playwright/test";

export interface ArenaCredentials {
  identifier: string; // username OU email
  password: string;
}

/** Retorna credenciais do operador semeado no banco de dados. */
export async function seedArenaUser(overrides: Partial<{
  username: string;
  email: string;
  password: string;
  role: "admin" | "gerente" | "atendente";
  modulesAllowed: string[];
  tenantSlug: string;
}> = {}): Promise<ArenaCredentials> {
  const role = overrides.role ?? "admin";
  const identifier =
    overrides.username ??
    overrides.email ??
    (role === "atendente" ? "atendente" : role === "gerente" ? "gerente" : "admin");
  const password = overrides.password ?? "admin123";

  return { identifier, password };
}

/** Faz login pela tela real (sem atalhos de sessão) — exercita o fluxo real do usuário. */
export async function loginAs(page: Page, creds: ArenaCredentials): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Usuário ou e-mail").fill(creds.identifier);
  await page.getByLabel("Senha").fill(creds.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await expect(page).toHaveURL(/\/(usuarios|dashboard|pdv|customers|admin)/);
}

export const test = base;
export { expect };
