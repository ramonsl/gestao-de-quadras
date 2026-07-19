# Spec-Driven Kit — Arena SaaS

Kit inicial para desenvolver o Arena SaaS com Claude Code em fluxo spec-driven.

## Como instalar no repositório

1. Copie o conteúdo desta pasta para a raiz do seu repositório
2. **Renomeie `dot-claude/` para `.claude/`** (o ponto importa)
3. Converta a especificação (Especificacao de Requisitos - Arena de Padel.docx)
   para markdown em `docs/spec/` — um arquivo por épico (e1-saas.md, e3-pdv.md...)
4. Abra o Claude Code na raiz: os agentes e skills carregam automaticamente

## O que está incluído

| Arquivo | Função |
|---|---|
| `CLAUDE.md` | Memória permanente: stack, regras invioláveis, fluxo, comandos |
| `dot-claude/agents/planner.md` | Arquiteto — plano técnico antes de cada US |
| `dot-claude/agents/tenant-guard.md` | Revisor de segurança multi-tenant (o mais importante) |
| `dot-claude/agents/test-runner.md` | QA — Vitest + Playwright derivados dos AC |
| `dot-claude/agents/spec-keeper.md` | Mantém a spec viva quando decisões mudam |
| `dot-claude/skills/nova-us/` | Comando do dia a dia: ciclo completo de uma US |
| `dot-claude/skills/migration/` | Migrations no modelo schema-por-tenant |
| `dot-claude/skills/novo-endpoint/` | Endpoint com tenant+permissão+validação+auditoria |
| `dot-claude/skills/whatsapp-msg/` | Novo tipo de notificação via fila/provider |
| `dot-claude/skills/release-check/` | Gate de qualidade antes de merge/deploy |
| `docs/boas-praticas-nextjs.md` | Padrões Next.js, testes e hospedagem |

## Uso no dia a dia

```
> /nova-us PDV-08        # implementa a US completa (plano → código → testes → review)
> /migration             # ao mexer em banco
> /release-check         # antes de fechar a fase
```

Regra de ouro: nunca "implemente o PDV" — sempre "implemente a PDV-08".
Escopo pequeno + spec como contrato = qualidade constante.
