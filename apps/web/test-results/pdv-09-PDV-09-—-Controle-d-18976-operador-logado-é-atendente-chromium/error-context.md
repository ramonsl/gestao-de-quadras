# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pdv-09.spec.ts >> PDV-09 — Controle de Cancelamentos e Estornos no PDV >> exibe campo de senha de supervisor quando o operador logado é atendente
- Location: e2e/pdv-09.spec.ts:54:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByTitle('Cancelar este item').first()

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - generic [ref=e6]: A
          - generic [ref=e7]: arena-demo
        - button "Recolher menu" [ref=e8]:
          - img [ref=e9]
      - generic "WhatsApp desconectado" [ref=e13]:
        - generic [ref=e15]: WhatsApp desconectado
      - navigation [ref=e16]:
        - generic [ref=e17]:
          - paragraph [ref=e18]: CADASTROS & OPERAÇÃO
          - generic [ref=e19]:
            - link "PDV / Comandas" [ref=e20] [cursor=pointer]:
              - /url: /pdv
              - img [ref=e21]
              - generic [ref=e25]: PDV / Comandas
            - link "Produtos" [ref=e26] [cursor=pointer]:
              - /url: /admin/produtos
              - img [ref=e27]
              - generic [ref=e31]: Produtos
            - link "Quadras" [ref=e32] [cursor=pointer]:
              - /url: /admin/quadras
              - img [ref=e33]
              - generic [ref=e35]: Quadras
            - link "Serviços de Quadra" [ref=e36] [cursor=pointer]:
              - /url: /admin/servicos-quadras
              - img [ref=e37]
              - generic [ref=e39]: Serviços de Quadra
            - link "Faixas Horárias" [ref=e40] [cursor=pointer]:
              - /url: /admin/faixas-horarias
              - img [ref=e41]
              - generic [ref=e44]: Faixas Horárias
            - link "Pacotes de Aulas" [ref=e45] [cursor=pointer]:
              - /url: /admin/pacotes-aulas
              - img [ref=e46]
              - generic [ref=e49]: Pacotes de Aulas
            - link "Espaços Publicitários" [ref=e50] [cursor=pointer]:
              - /url: /admin/publicidade/espacos
              - img [ref=e51]
              - generic [ref=e54]: Espaços Publicitários
            - link "Anunciantes" [ref=e55] [cursor=pointer]:
              - /url: /admin/publicidade/anunciantes
              - img [ref=e56]
              - generic [ref=e60]: Anunciantes
      - generic [ref=e62]:
        - paragraph [ref=e63]: atendente
        - paragraph [ref=e64]: atendente
    - main [ref=e66]:
      - generic [ref=e67]:
        - link "Voltar para a Grade de Comandas" [ref=e69] [cursor=pointer]:
          - /url: /pdv
          - img [ref=e70]
          - generic [ref=e72]: Voltar para a Grade de Comandas
        - generic [ref=e73]:
          - generic [ref=e74]:
            - generic [ref=e75]:
              - generic [ref=e76]: "Comanda #1efce73d"
              - generic [ref=e77]: Aberta
            - heading "Maria Oliveira" [level=1] [ref=e78]
            - generic [ref=e79]:
              - generic [ref=e80]: 51999992222 •
              - generic [ref=e81]: Aberto
              - generic [ref=e82]: Agora
          - button "Lançar Itens" [ref=e84]:
            - img [ref=e85]
            - generic [ref=e87]: Lançar Itens
        - generic [ref=e88]:
          - generic "Disponível quando a impressão térmica (CAD-07/PDV-12) for implementada" [ref=e89]:
            - checkbox "Imprimir ficha de produção Em breve" [disabled] [ref=e90]
            - text: Imprimir ficha de produção
            - generic [ref=e91]: Em breve
          - generic [ref=e92]:
            - generic [ref=e93]:
              - heading "Itens Lançados" [level=3] [ref=e94]
              - generic [ref=e95]: 0 lançamentos
            - table [ref=e96]:
              - rowgroup [ref=e97]:
                - row "Item Qtd Unit. Total Ações" [ref=e98]:
                  - columnheader "Item" [ref=e99]
                  - columnheader "Qtd" [ref=e100]
                  - columnheader "Unit." [ref=e101]
                  - columnheader "Total" [ref=e102]
                  - columnheader "Ações" [ref=e103]
              - rowgroup [ref=e104]:
                - row "Nenhum item lançado ainda." [ref=e105]:
                  - cell "Nenhum item lançado ainda." [ref=e106]
            - generic [ref=e107]:
              - generic [ref=e108]: Total Parcial Acumulado
              - generic [ref=e109]: R$ 0,00
  - button "Open Next.js Dev Tools" [ref=e115] [cursor=pointer]:
    - img [ref=e116]
  - alert [ref=e119]
```

# Test source

```ts
  1  | import { test, expect, loginAs, seedArenaUser } from "./fixtures";
  2  | 
  3  | /**
  4  |  * PDV-09 — Controle de Cancelamentos, Estornos e Correções no PDV
  5  |  */
  6  | 
  7  | async function openComandaAndEnsureItem(page: any) {
  8  |   await page.goto("/pdv");
  9  |   await page.getByText(/Maria Oliveira|Venda Balcão/i).first().click();
  10 |   await page.waitForURL(/\/pdv\/[a-z0-9-]+/);
  11 | 
  12 |   if (await page.getByText("Nenhum item lançado ainda.").isVisible()) {
  13 |     await page.getByRole("button", { name: "Lançar Itens" }).click();
  14 |     await page.getByText(/Heineken|Água|Coca|Red Bull/i).first().click();
  15 |     await page.getByRole("button", { name: "Confirmar Lançamento" }).click();
  16 |     await expect(page.getByText("Nenhum item lançado ainda.")).not.toBeVisible();
  17 |   }
  18 | }
  19 | 
  20 | test.describe("PDV-09 — Controle de Cancelamentos e Estornos no PDV", () => {
  21 |   test(
  22 |     "permite cancelamento de item com justificativa quando operador é gerente ou admin",
  23 |     async ({ page }) => {
  24 |       const operador = await seedArenaUser({ role: "admin" });
  25 |       await loginAs(page, operador);
  26 |       await openComandaAndEnsureItem(page);
  27 | 
  28 |       // When: clica no botão de lixeira do item
  29 |       await page.getByTitle("Cancelar este item").first().click();
  30 | 
  31 |       // Then: abre o modal de cancelamento
  32 |       await expect(page.getByText("Cancelar Item da Comanda")).toBeVisible();
  33 | 
  34 |       // And: preenche justificativa válida (>= 5 caracteres)
  35 |       await page.getByLabel(/Justificativa do Cancelamento/i).fill("Cliente desistiu antes do consumo.");
  36 |       await page.getByRole("button", { name: /Confirmar Cancelamento/i }).click();
  37 | 
  38 |       // Then: modal fecha após o cancelamento
  39 |       await expect(page.getByText("Cancelar Item da Comanda")).not.toBeVisible();
  40 |     }
  41 |   );
  42 | 
  43 |   test(
  44 |     "exibe erro de validação se a justificativa for menor que 5 caracteres",
  45 |     async ({ page }) => {
  46 |       const operador = await seedArenaUser({ role: "admin" });
  47 |       await loginAs(page, operador);
  48 |       await openComandaAndEnsureItem(page);
  49 | 
  50 |       await page.getByTitle("Cancelar este item").first().click();
  51 | 
  52 |       // When: preenche justificativa curta (ex.: "Erro")
  53 |       await page.getByLabel(/Justificativa do Cancelamento/i).fill("Erro");
  54 | 
  55 |       // Then: botão de confirmação permanece desabilitado
  56 |       await expect(page.getByRole("button", { name: /Confirmar Cancelamento/i })).toBeDisabled();
  57 |     }
  58 |   );
  59 | 
  60 |   test(
  61 |     "exibe campo de senha de supervisor quando o operador logado é atendente",
  62 |     async ({ page }) => {
  63 |       const atendente = await seedArenaUser({ role: "atendente" });
> 64 |       await loginAs(page, atendente);
     |                                                           ^ Error: locator.click: Test timeout of 30000ms exceeded.
  65 |       await openComandaAndEnsureItem(page);
  66 | 
  67 |       await page.getByTitle("Cancelar este item").first().click();
  68 | 
  69 |       // Then: exibe campo para digitação da senha do supervisor
  70 |       await expect(page.getByLabel(/Senha do Supervisor/i)).toBeVisible();
  71 |     }
  72 |   );
  73 | });
  74 | 
```