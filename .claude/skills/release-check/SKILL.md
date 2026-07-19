---
name: release-check
description: Verificacao completa antes de merge/deploy do Arena SaaS - suite de testes, cobertura dos AC da fase, revisao de seguranca e changelog. Use antes de fechar uma fase ou fazer deploy.
---

# Release check

Rode antes de qualquer merge para main ou deploy. Não aprove com item vermelho.

## 1. Suíte completa
`pnpm lint && pnpm typecheck && pnpm test && pnpm e2e`

## 2. Cobertura da spec
- Liste as US da fase/release (ver mapeamento de fases em `docs/spec/`)
- Para cada US: existe spec Playwright correspondente? Todos os AC têm teste?
- US sem teste = release bloqueada (regra do CLAUDE.md)

## 3. Segurança
- Acione o subagente **tenant-guard** sobre o diff acumulado da release
- Rode o teste de isolamento multi-tenant completo (`pnpm test:isolation`)
- Confira migrations pendentes e se o `tenant-template` está sincronizado

## 4. Operacional
- Variáveis de ambiente novas documentadas em `.env.example`
- Webhooks Asaas idempotentes (re-entrega não duplica cobrança/pontos)
- Sessões Baileys: reconexão testada após restart do worker

## 5. Changelog
- Gere `CHANGELOG.md` da release agrupado por épico, citando IDs das US
- Uma linha por US em linguagem de usuário (para o admin da arena entender)

## Saída
Relatório: OK/FALHA por seção, lista de bloqueios com responsável sugerido, e o changelog pronto. Só declare "pronto para deploy" com tudo OK.
