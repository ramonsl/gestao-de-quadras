# Épico E3 — PDV e Comandas

Este épico reúne todas as operações de frente de caixa (PDV) e comandas da arena. O princípio de design do PDV exige operação otimizada para toque (tablets), minimizando cliques para garantir rapidez no atendimento.

---

## PDV-01 [P0] — Abertura e Fechamento de Caixa
**Descrição:**
Como operador de caixa, quero abrir e fechar o caixa com conferência de valores e registrar sangrias e suprimentos, para ter controle financeiro por turno/operador.

**Critérios de Aceite:**
*   **Abertura de Caixa:** Exige informar o valor de saldo inicial (troco) em dinheiro (em centavos/integer) e o operador responsável.
*   **Fechamento de Caixa:** Exige o preenchimento dos valores físicos contados em caixa divididos por meio de pagamento (Dinheiro, Pix, Cartão, Pontos). O sistema deve cruzar os dados contados com os valores esperados do sistema e exibir o resumo detalhado indicando sobras ou quebras de caixa.

---

## PDV-02 [P0] — Lançamento de Itens em Comanda Identificada
**Descrição:**
Como operador de caixa, quero lançar produtos e serviços na comanda de um cliente identificado, para consolidar o consumo dele e cobrar ao final.

> **Decisão (2026-07-21):** PDV-02 passa a cobrir também o **cadastro rápido inline de cliente** (Nome + WhatsApp) diretamente na tela do PDV, para os casos em que a busca não encontra o cliente. O cadastro rápido não substitui a tela completa (`CAD-01`), que continua sendo o local para complementar e-mail, data de nascimento e demais dados — esses campos não são obrigatórios para a criação rápida.

**Critérios de Aceite:**
*   Permitir buscar e selecionar um cliente cadastrado (via busca rápida por nome ou WhatsApp) para vincular à comanda ativa. Se a busca não retornar nenhum resultado, o operador pode acionar o **cadastro rápido** do cliente sem sair da tela do PDV (ver critério abaixo).
*   **Cadastro Rápido de Cliente (Inline):** Quando a busca não encontra o cliente, o PDV permite cadastrá-lo na própria tela de lançamento, sem navegar até a tela completa de clientes (`CAD-01`).
    *   **Campos:** o formulário rápido solicita apenas **Nome** e **WhatsApp** (ambos obrigatórios). Os demais campos do cadastro completo (e-mail, data de nascimento, foto) não são exigidos neste fluxo — ficam disponíveis para complementação posterior na tela de clientes (`CAD-01`/`CAD-06`) e sua ausência não bloqueia a criação do cliente nem o lançamento de itens na comanda.
    *   **Identidade Global:** Ao informar o WhatsApp, o sistema consulta `global_customers` (schema `public`), com o mesmo comportamento de `CAD-01`: se já existir um cliente global com aquele número, seus dados (nome, e-mail, data de nascimento, foto) são reaproveitados e apenas o registro local do tenant é criado, vinculado ao `global_customer_id`; se o número for inédito, o sistema cria o registro global e, em seguida, o registro local do tenant.
    *   **Opt-in LGPD:** O consentimento para comunicações via WhatsApp é solicitado e registrado por arena, com o mesmo tratamento do cadastro completo (`CAD-01`).
    *   **Sem distinção de categoria:** O cliente criado pelo cadastro rápido é um cliente normal do CRM da arena — disponível imediatamente para busca, histórico de consumo, pontos e filiação, sem qualquer diferença em relação a um cliente cadastrado pela tela completa.
*   **Três caminhos para iniciar a comanda:** busca de cliente existente (critério acima), cadastro rápido de cliente novo (critério acima) ou nenhuma identificação — venda balcão/anônima, cujas regras completas estão em `PDV-03`.
*   Cada lançamento de item deve gravar internamente: ID do produto/serviço, quantidade, **valor unitário no momento do lançamento** (snapshot do preço vigente em centavos/integer), ID do operador de caixa e data/hora do lançamento. O preço gravado é imutável — alterações futuras no cadastro do produto nunca alteram registros já gravados.
*   **Interface de Lançamento Simplificada (Acessibilidade/Toque):** A tela de seleção e adição de itens deve ser otimizada para operadores com baixa familiaridade tecnológica ou em telas de toque (tablets):
    *   Os produtos devem ser exibidos como cards/botões grandes, organizados por categorias em abas de fácil acesso (ex.: Bebidas, Lanches, Quadras, Aulas).
    *   A seleção deve ser feita por clique/toque direto no card do produto, onde cada clique adiciona automaticamente 1 unidade do item ao carrinho lateral.
    *   O carrinho lateral deve permitir ajustar facilmente a quantidade (botões `+` e `-` grandes) ou remover o item antes de confirmar o lançamento.
*   **Botão Fechar/Voltar:** A interface de lançamento/adição de itens deve conter um botão "Fechar" ou "Voltar" destacado (ex.: no cabeçalho ou como botão de canto). Ao ser clicado, ele cancela a operação atual de edição/adição de itens não confirmados e retorna o operador à visualização anterior (grade de comandas ou detalhe da comanda), sem descartar itens que já haviam sido confirmados e gravados anteriormente na comanda.
*   **Impressão de Fichas de Produção:** Ao concluir o lançamento de um ou mais itens na comanda, se o seletor de impressão estiver ativo (ou configurado em `CAD-07`), o sistema dispara a impressão das fichas de produção/retirada em bobina térmica (fichas individuais por unidade, ver `PDV-12`).
*   Cada lançamento bem-sucedido na comanda de um cliente com opt-in ativo dispara uma notificação WhatsApp em tempo real contendo o item adicionado e o saldo acumulado (ver regras de agrupamento de mensagens em `WPP-02`).

> ### Roteiro de Teste Manual (QA)
>
> **Pré-condições:**
> *   Estar logado no PDV como Atendente, Gerente ou Admin, com uma comanda em processo de abertura/lançamento.
> *   Ter ao menos um cliente já cadastrado na arena atual, com WhatsApp conhecido (para testar o caminho de busca).
> *   Ter à mão um WhatsApp que não esteja cadastrado em nenhuma arena (para testar a criação de um registro global novo) e, se possível, um WhatsApp já cadastrado em **outra** arena de teste (para testar o reaproveitamento de `global_customers`).
>
> **Passo a passo:**
> 1.  Na tela do PDV, iniciar uma nova comanda e buscar por um cliente já cadastrado (nome ou WhatsApp).
>     *   **Esperado:** O cliente aparece na lista de resultados e pode ser vinculado normalmente à comanda (comportamento já existente, sem regressão).
> 2.  Buscar por um nome/WhatsApp que não retorna nenhum resultado.
>     *   **Esperado:** A tela exibe a opção de cadastro rápido (ex.: botão "Cadastrar novo cliente"), sem sair da tela do PDV.
> 3.  Acionar o cadastro rápido e preencher **Nome** e um **WhatsApp inédito** no sistema (não cadastrado em nenhuma arena). Confirmar.
>     *   **Esperado:** Cliente criado com sucesso; o registro global (`global_customers`) e o registro local do tenant são criados; o cliente fica imediatamente vinculado à comanda ativa.
> 4.  Acionar o cadastro rápido novamente informando um **WhatsApp já existente em `global_customers`** (de outra arena).
>     *   **Esperado:** Assim que o WhatsApp é digitado por completo (antes de submeter), a tela exibe uma prévia inline com os dados globais já encontrados (nome e e-mail, se houver), avisando que esses dados prevalecerão sobre o texto digitado no campo Nome. Ao confirmar o cadastro (botão "Cadastrar"), cria apenas o registro local do tenant vinculado ao cliente global, sem duplicar o registro global e sem etapa de confirmação separada — a prévia inline já cumpre esse papel antes do envio.
> 5.  Durante o cadastro rápido, observar a etapa de opt-in de comunicação via WhatsApp (LGPD).
>     *   **Esperado:** O opt-in é solicitado e registrado especificamente para a arena atual, igual ao fluxo da tela completa de clientes (`CAD-01`).
> 6.  Concluído o cadastro rápido, abrir a tela completa de Clientes (`CAD-01`) e localizar o cliente recém-criado.
>     *   **Esperado:** O cliente aparece normalmente na listagem/busca, com Nome e WhatsApp preenchidos e e-mail/data de nascimento em branco, editáveis como qualquer outro cliente — sem nenhuma marcação de "cadastro incompleto".
> 7.  Editar esse cliente pela tela completa, preenchendo e-mail e data de nascimento.
>     *   **Esperado:** Os dados são salvos normalmente e passam a valer globalmente (`CAD-06`), sem restrição adicional por ele ter sido criado originalmente via PDV.
> 8.  Repetir o passo 1 e, dessa vez, optar por não identificar nenhum cliente (seguir como venda balcão).
>     *   **Esperado:** A comanda é aberta como balcão/anônima conforme `PDV-03` (sem pontos, sem notificação WhatsApp), confirmando que os três caminhos — busca, cadastro rápido e anônimo — coexistem na mesma tela.
>
> **Casos de borda a validar manualmente:**
> *   Tentar concluir o cadastro rápido deixando o campo **Nome** em branco — deve bloquear a criação com mensagem de campo obrigatório.
> *   Tentar concluir o cadastro rápido deixando o campo **WhatsApp** em branco — deve bloquear a criação com mensagem de campo obrigatório.
> *   Informar um WhatsApp em formato inválido (sem DDI/DDD, com letras, número incompleto) — deve ser rejeitado pela mesma validação estrutural de `CAD-01`.
> *   Tentar cadastrar rapidamente um WhatsApp que já pertence a um cliente **local da própria arena atual** — o sistema deve reconhecer o cliente existente em vez de criar um duplicado no tenant.
> *   Cancelar o cadastro rápido no meio do preenchimento — a comanda deve permanecer aberta, permitindo tentar a busca novamente ou seguir como balcão, sem travar a tela.

---

## PDV-03 [P0] — Lançamento de Venda Balcão (Sem Identificação)
**Descrição:**
Como operador de caixa, quero lançar vendas sem cliente associado (comanda avulsa/balcão), para não travar a fila de atendimento caso o cliente não queira se identificar.

**Critérios de Aceite:**
*   O PDV deve permitir a abertura de uma venda rápida diretamente no balcão sem vincular um cliente cadastrado (venda anônima).
*   Vendas avulsas não geram pontuação de cashback nem disparam notificações WhatsApp.
*   O sistema deve permitir a conversão de uma venda balcão/comanda avulsa em comanda identificada (vinculando um cliente cadastrado) em qualquer momento antes do fechamento/pagamento final.
*   **Atalho de Abertura:** A venda balcão pode ser iniciada instantaneamente a partir do menu do botão flutuante de criação (`PDV-04`), abrindo diretamente a interface simplificada de lançamento de itens.

---

## PDV-04 [P0] — Controle de Comandas em Aberto (Visualização em Grade e Fluxo de Criação)
**Descrição:**
Como operador de caixa, quero visualizar as comandas em aberto em uma grade compacta de fácil leitura e abrir novas comandas através de um fluxo simplificado, para gerenciar com rapidez o consumo de múltiplos clientes na arena.

**Critérios de Aceite:**
*   **Grade Visual de Comandas (Grid Layout):**
    *   As comandas ativas na arena devem ser exibidas em uma grade com cards de tamanho compacto, otimizada para acomodar o máximo possível de comandas simultaneamente na tela do operador (ideal para tablets/desktops), reduzindo a necessidade de rolagem.
    *   **Cabeçalho do Card (Informações Visíveis):** Cada card de comanda na grade deve conter obrigatoriamente em seu cabeçalho:
        1.  **Identificação:** Nome do cliente associado (ou "Venda Balcão #[Código]" se for comanda avulsa).
        2.  **Tempo Aberta:** Tempo transcorrido desde a criação da comanda (ex.: "Há 15 min", "01h 45m").
        3.  **Valor Total:** O valor total acumulado dos itens lançados em formato monetário (R$).
    *   **Ação de Expansão/Visualização:** Clicar em qualquer card de comanda na grade abre a visualização expandida de detalhes daquela comanda, permitindo ao operador ver a lista completa de consumo, lançar novos itens ou prosseguir para o fechamento.
*   **Regra de Unicidade por Cliente (Comanda Única):**
    *   Um mesmo cliente (identificado por ID local/global) **não pode possuir mais de uma comanda em aberto simultaneamente** no mesmo tenant (arena).
    *   Se o operador tentar abrir uma nova comanda para um cliente que já possui uma comanda ativa, o sistema deve bloquear a criação, exibir um alerta visual informativo destacando que o cliente já possui uma comanda em aberto e fornecer um atalho/botão para abrir diretamente a comanda existente desse cliente.
*   **Botão Flutuante de Criação (FAB - Floating Action Button):**
    *   Exibir um botão flutuante circular com ícone de `+` ou texto "Nova Comanda" posicionado de forma fixa e visível (ex.: no canto inferior direito) na tela de controle de comandas.
    *   Ao clicar no botão flutuante, deve abrir um diálogo ou overlay de atalho rápido com duas opções:
        1.  **Venda Balcão (Avulsa):** Inicia imediatamente a comanda balcão e redireciona para a tela de seleção de itens (`PDV-03`).
        2.  **Identificar Cliente:** Exibe o campo de busca de cliente existente e botão para cadastro rápido inline (`PDV-02`).
    *   Assim que a identificação (ou opção balcão) é selecionada, o operador é direcionado diretamente para a interface simplificada de adição de itens para aquela comanda.
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

## PDV-05 [P0] — Grade Visual de Locação de Quadras e Rateio de Comandas
**Descrição:**
Como operador de caixa, quero uma tela de locação de quadras em formato de grade (quadras × blocos de 30 min), para agendar locações e optar por lançar o valor integral na comanda do responsável ou rateá-lo entre as comandas dos jogadores.

**Critérios de Aceite:**
*   **Grade por Slots de 30 Minutos e Seleção por Arraste (Drag-to-Select):** A tela do PDV exibe a grade de agendamentos contendo as quadras nas colunas e as frações de 30 minutos nas linhas. O operador pode clicar e arrastar (ou selecionar os blocos inicial e final) na mesma quadra para agendar períodos de 1h (2 blocos), 1h30 (3 blocos), 2h (4 blocos) ou mais de uma só vez, com cálculo acumulado em tempo real.
*   **Header Densificado com Data Centralizada:** A data escolhida ganha destaque centralizado no cabeçalho (ex.: `TERÇA-FEIRA, 12/08/2026`), e a grade possui margens reduzidas para maximizar o aproveitamento da tela sem rolagem vertical excessiva.
*   **Identificação de Status:** Diferenciar claramente os horários por cores/status: Livre, Ocupado (comanda vinculada), Rateio (múltiplas comandas), Reservado Online (sinal pago/pendente) e Mensalista (recorrente 🔄).
*   **Lançamento Integral, Rateado (N Jogadores) ou Mensalista:** Ao confirmar a locação da quadra:
    *   *Lançamento Integral:* O valor total é inserido na comanda de um único cliente responsável.
    *   *Rateio entre N Comandas (Divisão Ilimitada):* O operador pode selecionar N comandas abertas (2, 3, 4, 5 ou mais jogadores) e dividir o valor total da locação igualmente entre elas (ex.: R$ 180,00 divididos em 4 comandas = R$ 45,00/comanda).
    *   *Visualização Transparente dos Nomes no Rateio:* O card da locação na grade exibe explicitamente o nome de todos os pagantes envolvidos (`Fulano | Ciclano | Beltrano | Mário`).
    *   *Marcação de Mensalista:* Opção de marcar a locação como mensalista recorrente no modal, aplicando a tarifa mensalista da faixa (quando configurada).
*   **Controle e Sinalização de Mensalistas:**
    *   Locações contratadas no formato mensalista (ver `CAD-09`) exibem um badge distintivo (ex.: 🔄 *Mensalista*) e o status do pagamento do mês.
    *   *Alerta de Última Locação do Mês:* Na última ocorrência do dia da semana no mês vigente, o card da grade destaca um alerta visual ("Última locação do mês"), sinalizando ao operador a proximidade da renovação para o mês seguinte.
*   **Bloqueio de Duplicidade:** O sistema impede de forma rígida a dupla marcação (duplicidade) do mesmo horário e quadra na grade.

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
*   **Impressão de Extrato Consolidado:** O PDV permite imprimir o comprovante/extrato completo da comanda contendo a discriminação de todos os itens consumidos, descontos, resumo de pontos e meios de pagamento no momento da conferência ou encerramento (ver `PDV-12`).

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

> ### Decisões de Implementação (2026-08-15)
>
> *   **Permissão:** qualquer usuário com módulo `pdv` pode transferir — não exige autorização de supervisor.
> *   **Justificativa:** campo opcional (sem comprimento mínimo).
> *   **Pacotes de aulas (`class_package`):** transferência rejeitada se a comanda de destino não tiver cliente vinculado (`destination_requires_customer`).
> *   **Linhas inteiras:** a transferência move a linha completa (quantidade inteira); não há divisão parcial de quantidade.
> *   **Notificações WhatsApp:** duas mensagens de texto via `enqueueTextMessage` — uma para o cliente da comanda de origem ("itens transferidos") e outra para o cliente da comanda de destino ("itens recebidos"), ambas condicionadas ao opt-in LGPD.
> *   **Auditoria:** ação `pdv.items.transferred` registrada em `audit_logs` com IDs das comandas, IDs dos itens e justificativa.

---

## PDV-12 [P0] — Impressão Térmica de Fichas de Produção e Extrato de Comanda
**Descrição:**
Como operador de caixa, quero imprimir fichas individuais de produção (para que o cliente apresente na cozinha/bar e retire seus produtos) e o extrato consolidado da comanda (para conferência e pagamento final), diretamente em impressora térmica local sem janelas de confirmação desnecessárias.

**Critérios de Aceite:**
*   **Abordagem Técnica de Impressão:** A impressão utiliza HTML/CSS nativo via `@media print`, otimizado para navegadores executando em modo Kiosk (`--kiosk-printing`), enviando o cupom instantaneamente para a impressora térmica padrão configurada no sistema operacional.
*   **Adaptação ao Tamanho da Bobina:** As dimensões físicas do comprovante devem adaptar-se dinamicamente ao tamanho configurado no tenant (`58mm` ou `80mm`, ver `CAD-07`).
*   **Controle de Impressão no Lançamento (Fichas de Produção):**
    *   No PDV, haverá um seletor/toggle "Imprimir ficha de produção" visível na tela de lançamento.
    *   O estado inicial deste seletor respeita a configuração padrão da arena (`auto_print_production_tickets` em `CAD-07`), podendo ser alterado manualmente pelo operador no momento do lançamento.
*   **Regra de Fichas Individuais por Unidade (Item a Item):**
    *   Sempre que um lançamento contiver quantidade maior que 1 (ex.: 2 unidades de "Coca-Cola 350ml" ou 3 unidades de "Hambúrguer Artesanal"), o sistema **DEVE gerar e disparar impressões separadas de 1 unidade por ficha** (ex.: 1ª ficha contendo 1x Coca-Cola, e 2ª ficha contendo 1x Coca-Cola).
    *   **Justificativa Operacional:** As fichas são destacáveis e entregues ao cliente para troca/retirada na cozinha ou bar em momentos distintos ao longo da sua permanência na arena.
    *   Cada ficha individual de produção deve conter de forma legível:
        1. Nome da Arena;
        2. Identificador do item (ex.: "1x Coca-Cola 350ml");
        3. Identificação da Comanda e Nome do Cliente (ou "Venda Balcão");
        4. Data/Hora exata do lançamento;
        5. Identificador da Ficha/Sequencial (ex.: "Ficha 1 de 2");
        6. Nome/ID do operador de caixa.
*   **Extrato Consolidado de Comanda (Conferência e Fechamento):**
    *   Disponível para acionamento pelo operador a qualquer momento na tela da comanda ("Imprimir Extrato") e disparado automaticamente no encerramento da comanda (se configurado).
    *   O extrato consolidado reúne todo o consumo histórico acumulado da comanda em um único documento, contendo:
        1. Cabeçalho da Arena (Nome, CNPJ, Endereço);
        2. Número da Comanda, Nome do Cliente e CPF (se informado);
        3. Lista consolidada dos itens lançados (agrupados por item com Quantidade Total, Preço Unitário Snapshot e Valor Total);
        4. Subtotal da comanda;
        5. Descontos aplicados (ex.: desconto automático de filiado — `FIL-01`);
        6. Resumo de pontos/cashback (pontos utilizados como pagamento e pontos creditados na compra — `PTS-01`/`PDV-08`);
        7. Meio(s) de pagamento utilizado(s) e valor troco (se houver);
        8. Mensagem de rodapé configurada pelo tenant.

