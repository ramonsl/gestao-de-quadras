---
name: whatsapp-msg
description: Adiciona um novo tipo de notificacao WhatsApp no Arena SaaS via camada abstraida e fila. Use para qualquer mensagem nova (comanda, aniversario, campanha, fatura, pontos).
---

# Nova notificação WhatsApp

O WhatsApp é o diferencial do produto e o maior risco operacional (Baileys é biblioteca não oficial). Por isso TODA mensagem passa pela mesma esteira.

## Arquitetura fixa
- `packages/messaging` expõe `MessagingProvider` (hoje: Baileys; futuro: API oficial Meta). Baileys NUNCA é importado fora deste pacote
- Envio sempre via fila `notification.queue` (BullMQ) — nunca síncrono no request
- Uma sessão Baileys por tenant; status da conexão monitorado e exposto no painel

## Para adicionar um tipo de mensagem
1. Registre o tipo em `packages/messaging/templates/` com: nome, template pt-BR com placeholders tipados, e categoria (transacional | marketing)
2. Producer: no serviço de negócio, enfileire `{tenantId, clienteId, tipo, payload}` — o producer NÃO monta texto, só dados
3. Consumer (`apps/worker`): valida opt-in do cliente ANTES de enviar; monta o texto do template; envia via provider; grava log (enviado/erro + timestamp)
4. Retentativa: backoff exponencial, máx 3; erro final vira registro consultável

## Regras de produto
- Categoria marketing exige opt-in explícito; transacional exige opt-in de notificações; opt-out ("SAIR") bloqueia tudo imediatamente
- Lançamentos de comanda em sequência (janela de 3 min) são agrupados numa única mensagem — não spammar o cliente
- Nenhum dado sensível no texto além do necessário; valores em R$

## Teste
- Unit: producer enfileira payload correto; consumer respeita opt-out e agrupamento
- e2e: use o `FakeMessagingProvider` dos fixtures — nunca Baileys real em teste
