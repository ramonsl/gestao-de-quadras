# Épico E7 — Publicidade (Placas)

Este épico gerencia a locação de espaços publicitários físicos e digitais na arena (como placas de quadra, banners ou lonas), controlando contratos, vigências, faturamentos de patrocinadores e alertas de vencimento.

---

## PUB-01 [P0] — Cadastro de Espaços Publicitários e Anunciantes
**Descrição:**
Como administrador da arena, quero cadastrar espaços publicitários (placas por quadra/posição) e os anunciantes (empresas parceiras), para organizar comercialmente essa frente de receita.

**Critérios de Aceite:**
*   **Espaço Publicitário:** Cadastro do ponto de publicidade contendo: identificação (ex.: Placa 1 - Fundo da Quadra 1), tipo (placa física, lona, banner digital), status (disponível, ocupado, indisponível para manutenção) e valor de referência de locação.
*   **Anunciante:** Cadastro da empresa parceira contendo: Razão Social/Nome, CNPJ/CPF, e-mail e telefone do responsável financeiro.

---

## PUB-02 [P0] — Registro de Contratos de Publicidade e Alertas de Renovação
**Descrição:**
Como administrador da arena, quero registrar os contratos com vigência, valores e condições, e ser alertado sobre renovações e vencimentos, para evitar perda de faturamento.

**Critérios de Aceite:**
*   A criação do contrato de publicidade exige vincular um anunciante a um ou mais espaços publicitários cadastrados, informando a vigência (data de início e fim), valor mensal da locação (em centavos) e o dia de vencimento.
*   **Alertas de Vencimento:** O sistema deve notificar o administrador no painel de controle e por e-mail/WhatsApp com antecedência configurável (ex.: 30, 15 ou 5 dias antes do fim da vigência do contrato) para que o gestor realize a negociação de renovação.

---

## PUB-03 [P1] — Controle de Faturamento e Inadimplência de Anunciantes
**Descrição:**
Como administrador da arena, quero controlar o faturamento das parcelas de contratos de publicidade e identificar anunciantes em atraso, para garantir as cobranças em dia.

**Critérios de Aceite:**
*   Geração automática de lançamentos financeiros de contas a receber correspondentes às parcelas mensais de cada contrato de publicidade ativo.
*   Permitir marcar a quitação da parcela manualmente ou integrar com emissão de boletos/Pix via gateway de pagamentos.
*   Exibir relatório detalhado de inadimplência de publicidade exibindo: empresa parceira, contrato afetado, quantidade de dias em atraso e o valor total acumulado devido.
