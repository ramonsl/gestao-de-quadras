import { test as base, expect, type Page } from "@playwright/test";

/**
 * Fixtures de autenticação/tenant para os e2e do Arena SaaS.
 *
 * O login é por `username` OU `email` (SAAS-12) e o tenant é resolvido pelo
 * subdomínio — em dev/CI, pelo campo hidden `tenantSlug` do formulário e pela
 * env `TEST_TENANT_SLUG`. As credenciais de teste devem ser semeadas por uma
 * factory de seed (nunca reaproveitando estado de outro teste).
 *
 * Enquanto não há banco/seed de teste no ambiente, os specs que dependem destas
 * fixtures ficam marcados como `test.fixme` (ver saas-12.spec.ts).
 */

export interface ArenaCredentials {
  identifier: string; // username OU email
  password: string;
}

/** Semeia um operador via factory de seed do backend. Implementar quando o seed existir. */
export async function seedArenaUser(_overrides: Partial<{
  username: string;
  email: string;
  password: string;
  role: "admin" | "gerente" | "atendente";
  modulesAllowed: string[];
  tenantSlug: string;
}> = {}): Promise<ArenaCredentials> {
  throw new Error(
    "seedArenaUser() ainda não implementado: requer endpoint/CLI de seed de tenant de teste."
  );
}

/** Faz login pela tela real (sem atalhos de sessão) — exercita o fluxo do usuário. */
export async function loginAs(page: Page, creds: ArenaCredentials): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Usuário ou e-mail").fill(creds.identifier);
  await page.getByLabel("Senha").fill(creds.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  // auto-wait: espera a navegação para a área autenticada
  await expect(page).toHaveURL(/\/(usuarios|dashboard|pdv)/);
}

export const test = base;
export { expect };
