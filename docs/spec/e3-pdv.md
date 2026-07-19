# Épico E3 — PDV e Comandas

Este épico reúne todas as operações de frente de caixa (PDV) e comandas da arena. O princípio de design do PDV exige operação otimizada para toque (tablets), minimizando cliques para garantir rapidez no atendimento.

---

## PDV-01 [P0] — Abertura e Fechamento de Caixa
**Descrição:**
Como operador de caixa, quero abrir e fechar o caixa com conferência de valores e registrar sangrias e suprimentos, para ter controle financeiro por turno/operador.

**Critérios de Aceite:**
*   **Abertura de Caixa:** Exige informar o valor de saldo inicial (troco) em dinheiro (em centavos/integer) e o operador responsável.
*   **Suprimentos e Sangrias:** Exige informar o tipo da movimentação, valor em centavos, e uma justificativa obrigatória. Toda sangria ou suprimento gera um log de auditoria automático (ver `SAAS-05`).
*   **Fechamento de Caixa:** Exige o preenchimento dos valores físicos contados em caixa divididos por meio de pagamento (Dinheiro, Pix, Cartão, Pontos). O sistema deve cruzar os dados contados com os valores esperados do sistema e exibir o resumo detalhado indicando sobras ou quebras de caixa.

---

## PDV-02 [P0] — Lançamento de Itens em Comanda Identificada
**Descrição:**
Como operador de caixa, quero lançar produtos e serviços na comanda de um cliente identificado, para consolidar o consumo dele e cobrar ao final.

**Critérios de Aceite:**
*   Permitir buscar e selecionar um cliente cadastrado (via busca rápida por nome ou WhatsApp) para vincular à comanda ativa.
*   Cada lançamento de item deve gravar internamente: ID do produto/serviço, quantidade, valor unitário (em centavos), ID do operador de caixa e data/hora do lançamento.
*   Cada lançamento bem-sucedido na comanda de um cliente com opt-in ativo dispara uma notificação WhatsApp em tempo real contendo o item adicionado e o saldo acumulado (ver regras de agrupamento de mensagens em `WPP-02`).

---

## PDV-03 [P0] — Lançamento de Venda Balcão (Sem Identificação)
**Descrição:**
Como operador de caixa, quero lançar vendas sem cliente associado (comanda avulsa/balcão), para não travar a fila de atendimento caso o cliente não queira se identificar.

**Critérios de Aceite:**
*   O PDV deve permitir a abertura de uma venda rápida diretamente no balcão sem vincular um cliente cadastrado.
*   Vendas avulsas não geram pontuação de cashback nem disparam notificações WhatsApp.
*   O sistema deve permitir a conversão de uma venda balcão/comanda avulsa em comanda identificada (vinculando um cliente cadastrado) em qualquer momento antes do fechamento/pagamento final.

---

## PDV-04 [P0] — Controle de Comandas em Aberto
**Descrição:**
Como operador de caixa, quero que comandas possam permanecer em aberto, para que o cliente consuma ao longo de sua estadia na arena e pague somente ao final.

**Critérios de Aceite:**
*   O PDV deve ter um painel visual listando todas as comandas atualmente abertas na arena, mostrando: nome do cliente, tempo transcorrido desde a abertura e o valor total parcial acumulado.
*   Ao realizar o fechamento do caixa, o sistema deve alertar o operador se houver comandas ainda em aberto. O comportamento do sistema deve ser configurável para permitir que comandas permaneçam abertas para o próximo turno/operador ou exigir o fechamento obrigatório antes de fechar o caixa.

---

## PDV-11 [P0] — Transferência para Conta do Cliente (Saldo Devedor)
**Descrição:**
Como operador de caixa, quero transferir uma comanda não paga para a conta do cliente (saldo devedor), para que o valor não se perca e seja cobrado em visita futura.

**Critérios de Aceite:**
*   A transferência para saldo devedor exige que a comanda esteja vinculada a um cliente identificado.
*   **Limites de Devedor (Configurável por Arena):** O administrador do tenant pode configurar no sistema se a conta do cliente aceita saldo devedor, qual o valor de limite máximo permitido (ex.: R$ 200,00) e se novas comandas/vendas devem ser bloqueadas automaticamente quando o limite for excedido.
*   Ao abrir uma nova comanda para um cliente que possui saldo devedor pendente, o PDV deve exibir um alerta visual proeminente na tela indicando o saldo devedor e oferecendo a opção de adicioná-lo à cobrança atual.
*   A quitação do saldo devedor pode ser feita de forma total ou parcial, por qualquer meio de pagamento disponível no PDV.

---

## PDV-05 [P0] — Grade Visual de Locação de Quadras
**Descrição:**
Como operador de caixa, quero uma tela de locação de quadras em formato de grade (quadras × horários), para marcar horários e lançar locações na comanda de forma rápida.

**Critérios de Aceite:**
*   A tela do PDV deve exibir uma grade de agendamentos contendo as quadras nas colunas e os horários da grade nas linhas, permitindo navegar entre datas (dia atual e dias futuros).
*   A grade deve diferenciar claramente os horários por cores/status: Livre, Ocupado (comanda vinculada), Reservado (reserva online pendente de pagamento/confirmação).
*   Ao clicar em um horário livre, o caixa pode criar instantaneamente uma nova comanda vinculada à locação da quadra ou adicionar a locação a uma comanda existente.
*   O sistema deve impedir de forma rígida a dupla marcação (duplicidade) do mesmo horário e quadra na grade.

---

## PDV-06 [P0] — Venda de Aulas Avulsas e Pacotes
**Descrição:**
Como operador de caixa, quero vender aulas avulsas e pacotes de aulas, para registrar essa receita e gerenciar o saldo de aulas do aluno.

**Critérios de Aceite:**
*   A venda de pacotes de aulas (cadastrados em `CAD-03`) deve gerar um saldo de aulas no perfil do cliente selecionado.
*   Sempre que o cliente agendar e realizar uma aula do pacote, o operador de caixa deve debitar 1 aula do seu saldo no PDV.
*   O débito de aula no saldo envia uma notificação WhatsApp automática ao cliente ("Você utilizou uma aula. Saldo restante: X").

---

## PDV-07 [P0] — Fechamento de Comanda com Múltiplos Meios de Pagamento
**Descrição:**
Como operador de caixa, quero fechar comandas permitindo dividir o pagamento em um ou mais meios (dinheiro, Pix, cartão, pontos), para acomodar pagamentos compartilhados.

**Critérios de Aceite:**
*   O PDV deve permitir a divisão exata do valor total da comanda entre diferentes meios de pagamento (ex.: R$ 50,00 no cartão e R$ 20,00 em dinheiro).
*   Caso o pagamento inclua dinheiro, o sistema deve calcular e exibir na tela o valor exato do troco com base no valor recebido.
*   Descontos concedidos por filiação ativa do cliente (ver `FIL-01`) devem ser aplicados automaticamente no cálculo do total da comanda antes do encerramento, sem necessidade de interferência manual do caixa.

---

## PDV-08 [P0] — Resgate de Pontos como Meio de Pagamento no PDV
**Descrição:**
Como operador de caixa, quero aceitar pontos do programa de fidelidade como meio de pagamento da comanda, para dar utilidade prática aos pontos acumulados pelo filiado.

**Critérios de Aceite:**
*   A opção de pagar com pontos só deve ficar visível se o programa de pontos estiver ativo nas configurações do tenant (ver `PTS-01`) e se o cliente atrelado à comanda for elegível (ex: filiado ativo, se a regra de resgate exigir).
*   O sistema deve validar o saldo de pontos disponível do cliente e convertê-lo em valor monetário (R$) com base na taxa de resgate cadastrada (ex.: 100 pontos = R$ 1,00).
*   O uso de pontos como pagamento abate o valor da comanda no fechamento. **Regra de Negócio Inviolável:** Pagamentos efetuados com pontos não geram novos pontos sobre a parcela da comanda que foi paga em pontos.

---

## PDV-09 [P0] — Controle de Cancelamentos, Estornos e Correções
**Descrição:**
Como administrador, quero que o cancelamento de itens lançados ou o estorno de comandas fechadas exija permissão elevada e justificativa, para evitar fraudes operacionais.

**Critérios de Aceite:**
*   A exclusão de um item de comanda aberta ou o estorno completo de uma comanda fechada bloqueia a tela do caixa e exige autenticação de perfil Administrador (senha ou PIN).
*   Uma justificativa escrita para o cancelamento é obrigatória. A operação grava um log detalhado de auditoria contendo: operador do caixa, administrador autorizador, item, valor e justificativa.
*   **Correção de Pontos:** O estorno de uma venda ou item de comanda deve estornar/debitar automaticamente os pontos que haviam sido creditados ao cliente por aquele consumo.
*   Se o item estornado já havia sido notificado por WhatsApp ao cliente, o sistema deve disparar uma notificação de correção contendo o item excluído e o novo total da comanda.

---

## PDV-10 [P1] — Transferência de Itens entre Comandas
**Descrição:**
Como operador de caixa, quero transferir itens lançados incorretamente de uma comanda para outra, para ajustar erros operacionais de lançamento.

**Critérios de Aceite:**
*   Permitir selecionar um ou mais itens específicos de uma comanda ativa e transferi-los para outra comanda aberta (identificando a comanda de destino por número ou nome do cliente).
*   A transferência move o item mantendo todos os metadados (operador original que lançou e timestamp original de lançamento).
*   A ação recalcula automaticamente os saldos parciais de ambas as comandas e dispara as notificações de correção via WhatsApp aos clientes envolvidos (caso tenham opt-in ativo).
