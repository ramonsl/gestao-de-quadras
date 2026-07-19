# Épico E5 — Filiação (Clube de Benefícios)

Este épico abrange a gestão dos planos de filiação da arena (mensalistas/clubes), a cobrança automatizada via gateway de pagamento (Asaas), relatórios de recorrência e o autoatendimento dos filiados via WhatsApp.

---

## FIL-01 [P0] — Configuração de Planos de Filiação e Benefícios
**Descrição:**
Como administrador da arena, quero configurar planos de filiação definindo valores, periodicidade e benefícios (descontos e prioridades), para lançar o clube de benefícios da arena.

**Critérios de Aceite:**
*   A criação do plano de filiação exige informar: nome do plano, descrição, valor da mensalidade (em centavos), periodicidade de cobrança (mensal, semestral, anual).
*   Configurar benefícios integrados:
    *   **Desconto em produtos:** Percentual de desconto aplicável automaticamente a categorias selecionadas de produtos da copa (ex.: 10% de desconto na categoria "Bebidas").
    *   **Desconto em locação:** Percentual de desconto automático em locação de quadras ou serviços de aulas.
*   Os benefícios configurados no plano ativo do filiado devem ser aplicados de forma transparente no fechamento de suas comandas no PDV (ver `PDV-07`).

---

## FIL-02 [P0] — Cobrança Recorrente de Mensalidades (Asaas)
**Descrição:**
Como administrador da arena, quero cobrança recorrente automática das mensalidades dos filiados com gestão de inadimplência, para garantir receita previsível.

**Critérios de Aceite:**
*   Integração direta com o gateway Asaas para cadastrar cobranças recorrentes dos filiados (aceitando cartão de crédito ou Pix).
*   Em caso de falha no pagamento da mensalidade, o sistema realiza retentativas automáticas parametrizadas.
*   **Gestão de Inadimplência:** Filiados que estiverem com mensalidades em atraso perdem automaticamente os benefícios (descontos no PDV e na locação) até que a pendência seja regularizada.
*   Disponibilizar um painel de inadimplência listando filiados com faturas em aberto, o saldo total em atraso e um botão de ação rápida para reenviar link de pagamento via WhatsApp.

---

## FIL-03 [P0] — Autoatendimento do Filiado via WhatsApp
**Descrição:**
Como cliente filiado, quero consultar meu plano, faturas e carteirinha digital diretamente pelo WhatsApp da arena, para obter informações rápidas sem precisar baixar um aplicativo.

**Critérios de Aceite:**
*   O sistema deve processar mensagens recebidas no WhatsApp conectado (ver `WPP-01`) e responder de forma automática a comandos baseados em palavras-chave.
*   **Comando "carteirinha":** Retorna os dados do plano ativo do filiado (nome, plano, validade) em formato de mensagem estruturada ou imagem gerada dinamicamente.
*   **Comando "fatura":** Retorna o status da fatura atual e, se estiver pendente, o link de pagamento ou linha digitável Pix para quitação.
*   **Comando "pontos":** Retorna o saldo acumulado de pontos de fidelidade do cliente (ver `PTS-03`).

---

## FIL-04 [P1] — Relatório de Recorrência e Churn de Filiados
**Descrição:**
Como administrador da arena, quero relatórios de filiados ativos, novos, cancelados e churn mensal, para acompanhar a evolução e a saúde financeira do clube de benefícios.

**Critérios de Aceite:**
*   Exibir gráfico histórico contendo o número total de filiados ativos mês a mês.
*   Apresentar métricas acumuladas do mês corrente: quantidade de novas adesões, cancelamentos voluntários e suspensões automáticas por inadimplência.
*   Calcular a taxa de Churn Mensal (percentual de clientes cancelados em relação à base de ativos no início do período) e o MRR (Receita Recorrente Mensal) gerado pelas filiações.
