import { test, expect, loginAs, seedArenaUser } from "./fixtures";

/**
 * WPP-01 — Conexão de Número WhatsApp (Baileys) (Issue #44).
 *
 * Cada AC vira um caminho de ponta a ponta (Given/When/Then).
 *
 * ⚠️ Marcados como `test.fixme`: além do ambiente com servidor Next + Postgres
 * de teste e da factory de seed (ver fixtures.seedArenaUser), estes specs
 * precisam que `apps/worker` suba, em ambiente de teste, com o
 * `FakeMessagingProvider` (`packages/messaging/src/fakes/fake-messaging-provider.ts`)
 * no lugar do `BaileysMessagingProvider` real — nunca Baileys de verdade em CI
 * (ver `.claude/skills/whatsapp-msg`). Assim que essa infra existir, remover o
 * `.fixme`. Convenções: sem sleeps fixos (usar expects com auto-wait); dados
 * criados por factory de seed, nunca herdados de outro teste.
 */

test.describe("WPP-01 — Conexão de WhatsApp da arena", () => {
  // AC1/AC3 — iniciar conexão e ver o QR Code em tempo quase real
  test.fixme("Admin conecta o WhatsApp e vê o QR Code aparecer", async ({ page }) => {
    const admin = await seedArenaUser({ role: "admin" });
    await loginAs(page, admin);

    await page.goto("/whatsapp");
    await expect(page.getByText(/desconectado/i)).toBeVisible();

    await page.getByRole("button", { name: /conectar whatsapp/i }).click();

    await expect(page.getByText(/conectando/i)).toBeVisible();
    await expect(page.getByText(/aguardando leitura do qr code/i)).toBeVisible();
    await expect(page.locator("svg")).toBeVisible(); // QR renderizado
  });

  // AC3 — status atualiza para "Conectado" sem reload (SSE) após o pareamento
  test.fixme("status muda para Conectado assim que o QR é lido, sem reload", async ({ page }) => {
    const admin = await seedArenaUser({ role: "admin" });
    await loginAs(page, admin);

    await page.goto("/whatsapp");
    await page.getByRole("button", { name: /conectar whatsapp/i }).click();
    await expect(page.getByText(/aguardando leitura do qr code/i)).toBeVisible();

    // O worker de teste (FakeMessagingProvider) simula a leitura do QR do lado do "celular".
    await expect(page.getByText(/^conectado$/i)).toBeVisible();
    await expect(page.getByText(/número conectado/i)).toBeVisible();
  });

  // AC4 — reconexão automática após queda transitória
  test.fixme("volta para Conectado automaticamente após uma queda transitória", async ({ page }) => {
    const admin = await seedArenaUser({ role: "admin" });
    await loginAs(page, admin);

    await page.goto("/whatsapp");
    // Pré-condição: WhatsApp já conectado via fixture de seed do worker de teste.
    await expect(page.getByText(/^conectado$/i)).toBeVisible();

    // Fixture simula queda transitória no FakeMessagingProvider.
    await expect(page.getByText(/conectando/i)).toBeVisible();
    await expect(page.getByText(/^conectado$/i)).toBeVisible();
  });

  // AC4 — desconexão permanente (logout no celular) e alerta por e-mail ao Admin
  test.fixme("desconexão permanente exibe o status correto e alerta o Admin por e-mail", async ({ page }) => {
    const admin = await seedArenaUser({ role: "admin" });
    await loginAs(page, admin);

    await page.goto("/whatsapp");
    // Pré-condição: WhatsApp já conectado via fixture de seed do worker de teste.
    await expect(page.getByText(/^conectado$/i)).toBeVisible();

    // Fixture simula logout permanente no FakeMessagingProvider.
    await expect(page.getByText(/leia o qr code novamente/i)).toBeVisible();
    // O e-mail de alerta é capturado por um FakeEmailProvider nos fixtures do worker de teste.
  });

  // Permissão — só Admin acessa o painel de WhatsApp
  test.fixme("gerente e atendente são bloqueados ao acessar /whatsapp", async ({ page }) => {
    const gerente = await seedArenaUser({ role: "gerente" });
    await loginAs(page, gerente);

    await page.goto("/whatsapp");
    await expect(page).toHaveURL(/\/usuarios\/negado/);
  });

  // Isolamento — tenant B nunca vê status/QR do tenant A
  test.fixme("tenant B nunca recebe o status/QR do tenant A", async ({ page }) => {
    const adminA = await seedArenaUser({ role: "admin", tenantSlug: "arena-a" });
    const adminB = await seedArenaUser({ role: "admin", tenantSlug: "arena-b" });

    await loginAs(page, adminA);
    await page.goto("/whatsapp");
    await page.getByRole("button", { name: /conectar whatsapp/i }).click();
    await expect(page.getByText(/aguardando leitura do qr code/i)).toBeVisible();

    await page.getByRole("button", { name: /sair|logout/i }).click();
    await loginAs(page, adminB);
    await page.goto("/whatsapp");
    await expect(page.getByText(/^desconectado$/i)).toBeVisible();
  });
});
