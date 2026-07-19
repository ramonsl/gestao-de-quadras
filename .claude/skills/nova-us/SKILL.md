---
name: nova-us
description: Ciclo completo de implementacao de uma User Story do Arena SaaS - plano, implementacao, testes e review. Use quando o usuario pedir para implementar uma US pelo ID (ex. "implementa a PDV-08" ou "/nova-us PTS-01").
---

# Nova US — ciclo spec-driven

Implemente a US informada seguindo exatamente este ciclo. Nunca pule etapas.

## 1. Contexto
- Leia a US e seus critérios de aceite em `docs/spec/`
- Confirme que não há dependência pendente (US citadas que ainda não existem no código)
- Se a US for vaga ou conflitar com o código, pare e pergunte antes de codar

## 2. Plano
- Acione o subagente **planner** com o ID da US
- Apresente o plano ao usuário em resumo; ajuste se ele pedir

## 3. Implementação
- Siga o plano à risca; escopo extra descoberto no caminho vira anotação, não código
- Ordem: migration → `packages/core` (serviço + tipos) → rota/UI → job (se houver)
- Respeite as regras invioláveis do CLAUDE.md (tenant, centavos, fila, permissões)

## 4. Testes
- Acione o subagente **test-runner** para escrever e rodar Vitest + Playwright
- Todos os AC da US devem ter teste correspondente passando

## 5. Review
- Acione o subagente **tenant-guard** sobre o diff
- Corrija todos os BLOQUEANTES e re-rode a revisão até OK

## 6. Fechamento
- Se alguma decisão mudou a spec, acione o **spec-keeper**
- Commit: `feat(<ID>): <resumo>` + corpo listando AC cobertos
- Resuma para o usuário: o que foi feito, testes criados, pendências
