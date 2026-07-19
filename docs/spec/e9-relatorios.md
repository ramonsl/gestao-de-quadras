# Épico E9 — Relatórios e Dashboard

Este épico abrange os relatórios analíticos e dashboards consolidados da arena, provendo dados financeiros e operacionais em tempo real para tomada de decisão dos administradores.

---

## REL-01 [P0] — Dashboard de Faturamento Consolidado
**Descrição:**
Como administrador da arena, quero um dashboard consolidado exibindo o faturamento do dia e do mês dividido por frentes de receita, para enxergar a saúde financeira do negócio em uma única tela.

**Critérios de Aceite:**
*   Exibir indicadores numéricos de faturamento bruto do dia atual e acumulado do mês corrente.
*   **Valores históricos imutáveis:** Todos os cálculos de faturamento nos relatórios são baseados nos preços registrados no momento de cada venda (snapshot). Uma alteração posterior no preço de catálogo de um produto **não** altera os totais de relatórios de períodos anteriores.
*   **Divisão por Frente de Receita:** Apresentar gráficos de pizza ou barras dividindo as fontes de receita entre:
    *   **Copa/Vendas PDV:** Consumo de produtos e artigos esportivos.
    *   **Locações de Quadra:** Aluguéis de quadra avulsos ou recorrentes.
    *   **Aulas:** Aulas avulsas ou mensalidades de turmas.
    *   **Filiação:** Receita recorrente de planos de sócios (mensalidades do clube).
    *   **Publicidade:** Contratos ativos de locação de espaços de placas.
*   O dashboard deve ser atualizado dinamicamente à medida que as comandas são fechadas no PDV ou recebimentos são computados via gateway de pagamentos.

---

## REL-02 [P1] — Relatórios de Ocupação, Curva ABC e Campanhas
**Descrição:**
Como administrador da arena, quero relatórios detalhados de curva ABC de produtos, taxa de ocupação de quadras por faixa horária e desempenho de campanhas, para decidir estratégias com base em dados.

**Critérios de Aceite:**
*   **Curva ABC de Produtos:** Listagem dos produtos mais vendidos na copa por quantidade e por faturamento acumulado, indicando margens de contribuição.
*   **Taxa de Ocupação de Quadras:** Gráficos mostrando a porcentagem de horários reservados/ocupados por quadra e por dia da semana/faixa horária, facilitando a identificação de horários ociosos para aplicação de tarifas dinâmicas.
*   **Retorno de Campanhas de CRM:** Exibir o percentual de clientes reativados após receberem mensagens de campanhas automatizadas (ver `CRM-04`).
*   Todos os relatórios devem permitir exportação dos dados tabulares nos formatos PDF e CSV.
