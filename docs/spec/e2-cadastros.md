# Épico E2 — Cadastros

Este épico reúne as funcionalidades de cadastros bases necessários para a operação diária das arenas, abrangendo o cadastro de clientes (com foco na LGPD e WhatsApp), produtos da copa, serviços/quadras e a importação de dados.

---

## CAD-01 [P0] — Cadastro de Clientes e LGPD
**Descrição:**
Como operador de caixa, quero cadastrar clientes com nome, WhatsApp, e-mail e data de nascimento, para associar comandas, enviar notificações e gerenciar o programa de pontos.

**Critérios de Aceite:**
*   O campo **WhatsApp** é obrigatório e deve ser validado estruturalmente para habilitar o envio de qualquer notificação automática.
*   Deve conter o registro explícito de consentimento (opt-in) do cliente para o tratamento de dados e recebimento de comunicações via WhatsApp, salvando a data e hora do consentimento (em conformidade com a LGPD).
*   A data de nascimento é registrada para alimentar as campanhas de aniversário automáticas do CRM (ver `CRM-01`).
*   O sistema deve fornecer uma busca indexada rápida por nome parcial ou WhatsApp na tela de abertura de comanda do PDV.

---

## CAD-02 [P0] — Cadastro de Produtos da Copa e Estoque
**Descrição:**
Como administrador, quero cadastrar produtos da copa com preço, categoria e estoque, para vender no PDV com controle de estoque integrado.

**Critérios de Aceite:**
*   Cada produto deve ter: nome, código de barras (opcional), preço de venda (armazenado em centavos/integer), categoria (bebidas, lanches, acessórios, etc.), quantidade em estoque atual e limite de estoque mínimo.
*   Ao realizar uma venda de produto no PDV, o estoque do item deve ser debitado automaticamente em tempo real no fechamento da comanda.
*   Exibir alertas visuais no painel de administração e no PDV quando o estoque de um produto atingir o limite mínimo cadastrado.

---

## CAD-03 [P0] — Cadastro de Quadras, Serviços e Aulas
**Descrição:**
Como administrador, quero cadastrar quadras e serviços (locação por horário, aula avulsa, pacote de aulas), para disponibilizá-los para venda no PDV.

**Critérios de Aceite:**
*   Permitir o cadastro de quadras físicas (ex.: Quadra 1 - Vidro, Quadra 2 - Alvenaria) especificando modalidades (Padel, Beach Tennis).
*   Permitir a definição de preços diferenciados por faixa de horário (ex.: horário nobre das 18h às 22h com tarifa cheia e horários promocionais durante a tarde) e durações padrão de locação (ex.: 60 minutos, 90 minutos).
*   Permitir cadastrar pacotes de aulas (ex.: Pacote Mensal de 4 ou 8 aulas) com controle de saldo de aulas atrelado ao cadastro do cliente (aluno).

---

## CAD-04 [P1] — Importação de Clientes via Planilha
**Descrição:**
Como administrador, quero importar clientes em lote a partir de uma planilha (CSV / Excel), para migrar minha base atual sem necessidade de redigitação manual.

**Critérios de Aceite:**
*   Disponibilizar uma planilha modelo para download contendo as colunas obrigatórias: Nome, WhatsApp (formato internacional), E-mail, Data de Nascimento e Opt-in LGPD (True/False).
*   Realizar a validação dos dados da planilha antes da inserção no banco de dados. Linhas com WhatsApps inválidos ou dados corrompidos devem ser rejeitadas, gerando um relatório detalhado de erros contendo o número da linha e o campo inválido.
*   Por padrão, clientes importados que possuem consentimento ativo (LGPD) devem ter a data/hora da importação registrada como timestamp do opt-in.

---

## CAD-05 [P0] — Cadastro da Grade de Horários da Quadra
**Descrição:**
Como administrador, quero cadastrar a grade de horários disponíveis de cada quadra, para abrir a agenda para locações e reservas.

**Critérios de Aceite:**
*   Permitir configurar, para cada dia da semana e quadra, as janelas de horários disponíveis (ex.: Segunda a Sexta, das 07h às 23h, em intervalos de 1h ou 1.5h) e seus respectivos valores.
*   Permitir o bloqueio de horários ou quadras inteiras para manutenção interna, torneios ou eventos corporativos, impedindo reservas públicas nesses horários.
*   Alterações na grade de horários devem refletir de forma instantânea tanto na visualização da grade no PDV físico quanto no widget público de reservas online (ver `RES-01`).
