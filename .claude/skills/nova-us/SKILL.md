---
name: nova-us
description: Ciclo completo de implementacao de uma User Story do Arena SaaS - plano, implementacao, testes e review. Use quando o usuario pedir para implementar uma US pelo ID (ex. "implementa a PDV-08" ou "/nova-us PTS-01").
---

# Nova US — ciclo spec-driven

Implemente a US informada seguindo exatamente este ciclo. Nunca pule etapas.

## 1. Contexto
- Busque a especificação da US nos arquivos locais de `docs/spec/`.
- Consulte a issue correspondente no GitHub usando `gh issue view <ID>` (ou pelo número da issue) para ler os comentários, discussões e alinhamentos recentes que possam não estar consolidados na especificação local.
- Confirme que não há dependências de código pendentes (outras USs necessárias que ainda não foram implementadas).
- Se houver divergências ou dúvidas, pare e alinhe com o usuário antes de planejar.

## 2. Plano
- Acione o subagente **planner** com o ID da US.
- Apresente o plano ao usuário em resumo; ajuste se ele pedir.

## 3. Implementação
- **Git Flow:** Antes de começar a codificar, crie uma branch de feature a partir da branch `dev` usando a convenção:
  `git checkout dev && git pull && git checkout -b feat/<ID>-nome-da-feature`
  *(substitua <ID> pelo código da US, ex.: CAD-01)*.
- Siga o plano à risca; escopo extra descoberto no caminho vira anotação, não código.
- Ordem de arquivos: migrations → `packages/core` (serviços e tipos) → rotas/UI (Next.js/Actions) → workers/jobs (se aplicável).
- Respeite rigorosamente as regras invioláveis do CLAUDE.md (tenant, centavos, filas, etc.).
- **UI & Types**: usar Shadcn/ui e `packages/ui` (buscar antes de criar componentes). Zero `any` e tipagem TypeScript estrita.
- **Design System**: ao criar qualquer tela ou componente, consultar a skill **novo-componente** e o documento `docs/design-system.md` para garantir tokens, tipografia, microcopy e comportamentos corretos.
- **Boy Scout Rule**: ao editar arquivos existentes, resolva os erros de lint que encontrar neles.

## 4. Testes
- Acione o subagente **test-runner** para escrever e rodar Vitest + Playwright.
- Todos os critérios de aceite (AC) da US devem ter testes automatizados correspondentes passando.

## 5. Review
- Acione o subagente **tenant-guard** sobre o diff para garantir o isolamento estrito de tenants.
- Acione o subagente **security-guard** sobre o diff para validar segurança de rotas, APIs, dependências e vulnerabilidades de pacotes.
- Se o diff incluir arquivos de UI (`.tsx`, `.css`), acione o subagente **ui-guard** para validar conformidade com o design system.
- Corrija todos os BLOQUEANTES e re-rode as revisões de segurança até obter OK.

## 6. Fechamento e Entrega
- Se alguma decisão técnica ou de negócio alterou os requisitos originais, atualize o arquivo correspondente em `docs/spec/` (e informe o spec-keeper).
- Faça o commit das alterações: `git add . && git commit -m "feat(<ID>): <breve resumo do que foi feito>"`
- Envie a branch para o remote: `git push -u origin feat/<ID>-nome-da-feature`
- **Abertura de PR:** Crie o Pull Request apontando a branch da feature para a branch **`dev`** usando o CLI do GitHub:
  `gh pr create --base dev --title "feat(<ID>): <Nome da US>" --body "Closes #<Numero da Issue do GitHub>"`
- **GitHub Projects:** Mova a issue correspondente para a coluna **"Test"** (ou "Em Teste") no quadro de projetos do GitHub usando o CLI do GitHub ou indicando o status ao usuário.
- Apresente o resumo final do trabalho, o link do PR criado e o status atualizado do ticket no quadro.
