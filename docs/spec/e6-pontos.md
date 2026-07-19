# Épico E6 — Pontos / Cashback

Este épico abrange as regras do programa de fidelidade por pontos/cashback, englobando a área de configuração de acúmulo e resgate, crédito automático no PDV, relatórios de controle de passivos e consulta de extrato pelo WhatsApp.

---

## PTS-01 [P0] — Configurações do Programa de Pontos
**Descrição:**
Como administrador da arena, quero uma área de configuração do programa de pontos, para definir as regras de fidelidade personalizadas da minha arena (inclusive desativar o programa).

**Critérios de Aceite:**
*   **Habilitação Geral:** Permitir ativar ou desativar por completo o programa de pontos na arena. Se desativado, o sistema oculta as opções de acúmulo e resgate em todo o sistema.
*   **Regra de Conversão de Acúmulo:** Configurar a taxa de ganho (ex.: a cada R$ 1,00 gasto = 1 ponto). Deve permitir regras distintas por categoria de consumo (Copa, Locação de Quadras, Serviços/Aulas).
*   **Restrição de Participantes:** Configurar quem pode acumular e resgatar pontos:
    *   Todos os clientes cadastrados.
    *   Apenas clientes filiados ativos (clientes comuns acumulam, mas só podem resgatar se aderirem a um plano de filiação).
*   **Regra de Conversão de Resgate:** Configurar a taxa de resgate (ex.: 100 pontos = R$ 1,00 de desconto).
*   **Resgate Parcial e Limites:** Configurar se o cliente pode realizar resgates parciais e o limite máximo de abatimento da comanda em pontos (ex.: máximo de 50% do valor da comanda pago em pontos).
*   **Validade:** Configurar o período de expiração dos pontos (ex.: pontos expiram após 180 dias do acúmulo).

---

## PTS-02 [P0] — Acúmulo Automático no Fechamento de Comanda
**Descrição:**
Como cliente, quero acumular pontos automaticamente ao fechar minha comanda no PDV, para ser recompensado de forma transparente pelo consumo.

**Critérios de Aceite:**
*   **Gatilho de Crédito:** Os pontos são creditados na conta do cliente apenas no momento exato do encerramento financeiro (fechamento) da comanda no PDV, e não no momento do lançamento dos itens.
*   **Exclusão de Resgate:** Se parte do pagamento da comanda foi efetuado utilizando pontos como abatimento, novos pontos de cashback são calculados **apenas sobre o saldo pago em dinheiro/cartão/Pix**, nunca sobre a parcela paga em pontos (ver `PDV-08`).
*   **Ajuste por Estorno:** Se um item for cancelado ou estornado posteriormente, os pontos equivalentes gerados por ele devem ser debitados automaticamente do saldo do cliente (ver `PDV-09`).

---

## PTS-03 [P0] — Consulta de Pontos e Extrato via WhatsApp
**Descrição:**
Como cliente filiado, quero consultar meu saldo de pontos e o extrato recente via WhatsApp, para acompanhar meus benefícios e saber quanto posso resgatar.

**Critérios de Aceite:**
*   O chatbot do WhatsApp conectado deve responder automaticamente ao comando chave "pontos".
*   A resposta deve conter de forma estruturada: saldo total de pontos ativos e o equivalente em reais (R$) para resgate, além da data de validade dos pontos mais próximos de expirar.
*   Deve listar de forma resumida as últimas 3 transações de acúmulo ou resgate (data, tipo e quantidade de pontos).

---

## PTS-04 [P1] — Relatório Consolidado e Controle de Passivo de Pontos
**Descrição:**
Como administrador da arena, quero um relatório de pontos emitidos, resgatados e expirados, para acompanhar o passivo financeiro e o engajamento do programa de fidelidade.

**Critérios de Aceite:**
*   Disponibilizar filtros de busca por período de datas na tela de relatórios.
*   Exibir indicadores numéricos contendo: total de pontos gerados no período, total de pontos resgatados e total de pontos que expiraram sem uso.
*   Apresentar o saldo total de passivo circulante da arena (quantidade total de pontos de todos os clientes atualmente ativos convertidos no valor correspondente em R$), permitindo previsibilidade contábil.
