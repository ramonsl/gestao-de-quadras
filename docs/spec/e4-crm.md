# Épico E4 — CRM

Este épico reúne as ferramentas de relacionamento com o cliente (CRM) e campanhas de marketing, focando na reativação de clientes inativos, mensagens automatizadas e segmentação de público.

---

## CRM-01 [P0] — Notificação de Aniversário Automatizada
**Descrição:**
Como usuário de marketing, quero que o sistema envie automaticamente mensagens de aniversário (WhatsApp/E-mail) com texto personalizável, para fortalecer o relacionamento com o cliente.

**Critérios de Aceite:**
*   Permitir configurar um template padrão de texto para envio no dia do aniversário do cliente. O template aceita variáveis dinâmicas (ex.: `{nome}`, `{arena_nome}`).
*   O envio deve ser processado pelo Worker de forma automática todos os dias, na janela de horário definida pelo administrador da arena (ex.: 09:00h da manhã).
*   O sistema deve validar se o cliente possui opt-in ativo de marketing antes do envio.
*   Registrar na linha do tempo do cliente (ver `CRM-05`) e em logs gerais o envio da notificação.

---

## CRM-02 [P0] — Alerta e Mensagens para Clientes Inativos (Churn)
**Descrição:**
Como usuário de marketing, quero ser alertado quando um cliente ficar X dias sem consumir ou visitar a arena (X configurável), para realizar ações de reativação de forma rápida.

**Critérios de Aceite:**
*   Permitir que o administrador configure o limite de dias de inatividade (ex.: 30 dias sem compras ou reservas).
*   Disponibilizar uma tela com a listagem dos "Clientes em Risco de Churn", ordenada de forma decrescente pelo valor histórico de consumo de cada um na arena.
*   A tela deve fornecer uma ação rápida em um clique para disparar uma mensagem de reativação via WhatsApp (usando um template de texto também parametrizável, ex: oferecendo um cupom ou bônus de pontos).

---

## CRM-03 [P0] — Classificação e Segmentação Automática de Clientes
**Descrição:**
Como usuário de marketing, quero que os clientes sejam classificados automaticamente pelo volume de consumo (ex.: Ouro, Prata, Bronze), para direcionar ofertas e promoções por segmentos de público.

**Critérios de Aceite:**
*   Permitir ao administrador definir as faixas de valor acumulado de consumo nos últimos 90 dias para cada categoria:
    *   **Bronze:** Gasto de R$ 0,00 a R$ 200,00.
    *   **Prata:** Gasto de R$ 200,01 a R$ 600,00.
    *   **Ouro:** Gasto acima de R$ 600,00.
*   A reclassificação deve rodar de forma automática e periódica (diariamente na rotina do Worker).
*   A categoria ativa do cliente deve ficar visível em sua ficha cadastral no PDV e ser utilizável como filtro na criação de campanhas de CRM.

---

## CRM-04 [P0] — Criação de Campanhas de Disparo para Segmentos
**Descrição:**
Como usuário de marketing, quero criar campanhas de promoção para um segmento de clientes (inativos, aniversariantes, filiados ou classes de consumo), para trazê-los de volta à arena.

**Critérios de Aceite:**
*   A criação de campanha exige definir: nome da campanha, filtro de público (ex.: todos os clientes da classe "Ouro" ou clientes "Inativos há mais de 30 dias") e o texto da mensagem.
*   O envio em massa deve rodar em background pelo Worker usando filas (`notification.queue`) para evitar sobrecarga de conexão do WhatsApp.
*   **Regra de Opt-out:** O sistema deve verificar rigorosamente o status de consentimento (opt-in) de cada cliente. Clientes que solicitaram descadastramento (opt-out) não devem receber mensagens de marketing em hipótese alguma.
*   Gerar um relatório consolidado da campanha exibindo: quantidade de mensagens enviadas, entregues com sucesso e falhas/erros encontrados.

---

## CRM-05 [P1] — Linha do Tempo Consolidada do Cliente (Timeline)
**Descrição:**
Como usuário de marketing, quero visualizar a linha do tempo detalhada do cliente contendo visitas, consumo, mensagens recebidas e pontos, para entender seu relacionamento com a arena antes de abordá-lo.

**Critérios de Aceite:**
*   Disponibilizar uma visualização cronológica unificada no perfil do cliente reunindo:
    *   Datas de visitas e comandas fechadas (com o valor gasto).
    *   Histórico de pontos acumulados, resgatados e expirados.
    *   Histórico de mensagens automáticas ou campanhas de marketing enviadas (e status de entrega).
    *   Locações de quadras agendadas/realizadas.
