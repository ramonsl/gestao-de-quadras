import { test, expect, loginAs, seedArenaUser } from "./fixtures";

/**
 * PDV-06 — Venda de Aulas Avulsas e Pacotes
 *
 * Cada bloco deriva dos Critérios de Aceite da spec (docs/spec/e3-pdv.md, PDV-06).
 * A cobertura unitária das regras de serviço está em:
 *   - `packages/core/src/classes/class-balance.service.test.ts`
 *   - `packages/core/src/pdv/comanda.service.test.ts` (addClassPackageItemToComanda + closeComanda AC3)
 *
 * ⚠️ Marcados como `test.fixme`: exigem servidor Next + Postgres de teste e seed
 * de tenant/operador/cliente/pacote/comanda. Convenções:
 *   - sem sleeps fixos (Playwright auto-wait em todos os expects)
 *   - dados de teste criados por factory de seed, nunca dependentes de outro teste
 *   - valores em centavos no back, exibidos em reais na UI
 */

test.describe("PDV-06 — Venda de Aulas Avulsas e Pacotes", () => {
  // AC1 — Pacotes ativos aparecem na aba correta para comanda com cliente identificado
  test.fixme(
    "AC1: pacotes de aulas ativos aparecem na aba 'Pacotes de Aulas' para comanda com cliente",
    async ({ page }) => {
      const operador = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
      // Pré-condição: pacote "Mensal 8 Aulas" (ativo) cadastrado no tenant;
      // comanda aberta e identificada com a cliente "Maria".
      await loginAs(page, operador);
      await page.goto("/pdv");

      // When: abre a comanda identificada e navega até a aba de pacotes
      await page.getByText("Maria").click();
      await page.getByRole("tab", { name: /Pacotes de Aulas/i }).click();

      // Then: o pacote ativo aparece como opção de lançamento
      await expect(page.getByRole("button", { name: /Mensal 8 Aulas/i })).toBeVisible();

      // And: pacotes inativos NÃO aparecem (garantido pelo filtro is_active = true)
      await expect(
        page.getByRole("button", { name: /Pacote Inativo de Teste/i })
      ).not.toBeVisible();
    }
  );

  // AC2 — Comanda sem cliente não pode receber pacotes de aulas
  test.fixme(
    "AC2: aba de pacotes exibe aviso quando a comanda é balcão (sem cliente identificado)",
    async ({ page }) => {
      const operador = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
      // Pré-condição: comanda balcão (sem cliente) aberta.
      await loginAs(page, operador);
      await page.goto("/pdv");

      // When: abre a comanda balcão e tenta acessar a aba de pacotes
      await page.getByText(/Venda Balcão/i).click();
      await page.getByRole("tab", { name: /Pacotes de Aulas/i }).click();

      // Then: aviso informando que a comanda precisa ter um cliente identificado
      await expect(
        page.getByText(/identifique o cliente para adicionar pacotes de aulas/i)
      ).toBeVisible();
    }
  );

  // AC2 — Tentar adicionar pacote em comanda balcão retorna erro da API
  test.fixme(
    "AC2: tentar adicionar pacote em comanda sem cliente resulta em erro visível na UI",
    async ({ page }) => {
      const operador = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
      await loginAs(page, operador);
      await page.goto("/pdv");

      await page.getByText(/Venda Balcão/i).click();
      await page.getByRole("tab", { name: /Pacotes de Aulas/i }).click();

      // Tenta adicionar (botão pode estar desabilitado ou exibir erro ao clicar)
      const addButton = page.getByRole("button", { name: /Adicionar|Lançar/i }).first();
      if (await addButton.isEnabled()) {
        await addButton.click();
        // Then: mensagem de erro do backend propagada para a UI
        await expect(
          page.getByText(/cliente obrigatório|comanda sem cliente|identifique/i)
        ).toBeVisible();
      } else {
        // Alternativa válida: o botão já está desabilitado
        await expect(addButton).toBeDisabled();
      }
    }
  );

  // AC6 — Débito de aula decrementa o saldo na UI
  test.fixme(
    "AC6: débito de 1 aula decrementa o saldo exibido na UI (de 8 para 7)",
    async ({ page }) => {
      const operador = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
      // Pré-condição: cliente "Maria" possui saldo de 8 aulas no pacote "Mensal 8 Aulas"
      // (gerado após o fechamento de uma comanda com esse pacote — seed).
      await loginAs(page, operador);
      await page.goto("/pdv");

      // When: navega para o painel de saldo de aulas da cliente
      await page.getByText("Maria").click();
      await page.getByRole("tab", { name: /Aulas|Saldo de Aulas/i }).click();

      // Verifica saldo inicial
      await expect(page.getByText(/8 aulas? restantes|saldo.*8/i)).toBeVisible();

      // Debita 1 aula
      await page.getByRole("button", { name: /Debitar 1 Aula/i }).click();

      // Then: o saldo cai para 7 (UI atualiza sem reload completo)
      await expect(page.getByText(/7 aulas? restantes|saldo.*7/i)).toBeVisible();
    }
  );

  // AC7 — Botão de débito desabilitado quando saldo = 0
  test.fixme(
    "AC7: botão 'Debitar 1 Aula' fica desabilitado quando remaining_classes = 0",
    async ({ page }) => {
      const operador = await seedArenaUser({ role: "atendente", modulesAllowed: ["pdv"] });
      // Pré-condição: cliente "João" com saldo esgotado (remaining_classes = 0) — seed.
      await loginAs(page, operador);
      await page.goto("/pdv");

      await page.getByText("João").click();
      await page.getByRole("tab", { name: /Aulas|Saldo de Aulas/i }).click();

      // Then: o botão de débito está desabilitado (saldo = 0)
      await expect(
        page.getByRole("button", { name: /Debitar 1 Aula/i })
      ).toBeDisabled();

      // And: indicação visual de que o saldo está esgotado
      await expect(page.getByText(/0 aula|saldo esgotado|sem aulas/i)).toBeVisible();
    }
  );

  // Isolamento de tenant (AC10) — tenant B não enxerga dados do tenant A
  test.fixme(
    "isolamento de tenant: operador do tenant B não enxerga saldos de aulas do tenant A",
    async ({ page }) => {
      // Pré-condição: tenant A tem "Maria" com 5 aulas no pacote "Mensal A";
      // tenant B tem "Carlos" com 3 aulas no pacote "Mensal B" (seeds separados).
      const operadorB = await seedArenaUser({
        role: "admin",
        modulesAllowed: ["pdv"],
        tenantSlug: "tenant-b",
      });
      await loginAs(page, operadorB);
      await page.goto("/pdv");

      // When: operador B tenta ver saldo de "Maria" (cliente do tenant A)
      await page.getByRole("searchbox", { name: /buscar cliente/i }).fill("Maria");

      // Then: cliente do tenant A não aparece na busca do tenant B
      await expect(page.getByText("Maria")).not.toBeVisible();

      // And: apenas clientes do próprio tenant B aparecem
      await expect(page.getByText("Carlos")).toBeVisible();
    }
  );

  // Integração PDV-06 → fechar comanda com pacote → crédito de saldo
  test.fixme(
    "fecha comanda com pacote de aulas e gera saldo de aulas para o cliente",
    async ({ page }) => {
      const operador = await seedArenaUser({ role: "gerente", modulesAllowed: ["pdv"] });
      // Pré-condição: pacote "Mensal 8 Aulas" ativo; comanda aberta com "Maria"
      // e 1 unidade do pacote lançada (seed).
      await loginAs(page, operador);
      await page.goto("/pdv");

      await page.getByText("Maria").click();

      // Verifica que o item de pacote consta na comanda
      await expect(page.getByText(/Mensal 8 Aulas/i)).toBeVisible();

      // When: fecha a comanda via Pix
      await page.getByRole("button", { name: /Fechar (Comanda|e Pagar)/i }).click();
      await page.getByLabel(/Meio de Pagamento/i).selectOption({ label: "Pix" });
      await page.getByLabel(/Valor/i).first().fill("320,00");
      await page.getByRole("button", { name: /Finalizar e Fechar Comanda/i }).click();

      // Then: comanda fechada com sucesso
      await expect(page).toHaveURL(/\/pdv$/);

      // And: abre nova comanda para Maria e verifica o saldo de aulas creditado (AC3)
      await page.getByRole("button", { name: /Nova Comanda|Identificar Cliente/i }).click();
      await page.getByRole("searchbox", { name: /buscar cliente/i }).fill("Maria");
      await page.getByText("Maria").click();
      await page.getByRole("tab", { name: /Aulas|Saldo de Aulas/i }).click();

      // Deve exibir 8 aulas creditadas
      await expect(page.getByText(/8 aulas? restantes|saldo.*8/i)).toBeVisible();
    }
  );
});
