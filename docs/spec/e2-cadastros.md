# Épico E2 — Cadastros

Este épico reúne as funcionalidades de cadastros bases necessários para a operação diária das arenas, abrangendo o cadastro de clientes (com foco na LGPD, WhatsApp e identidade global compartilhada), produtos da copa, serviços/quadras e a importação de dados.

---

## CAD-01 [P0] — Cadastro de Clientes, LGPD e Identidade Global
**Descrição:**
Como Atendente ou Gerente, quero cadastrar clientes com nome, WhatsApp, e-mail e data de nascimento, para associar comandas, enviar notificações e gerenciar o programa de pontos; e quero que clientes já cadastrados em outras arenas do sistema tenham seus dados globais reaproveitados automaticamente.

**Critérios de Aceite:**
*   O campo **WhatsApp** é obrigatório e é o **identificador universal** do cliente entre todas as arenas do sistema. Deve ser validado estruturalmente no formato internacional.
*   **Identidade Global (cross-arena):** Ao cadastrar um cliente informando seu WhatsApp, o sistema consulta o schema `public` buscando um registro global (`global_customers`) com aquele número:
    *   **Cliente já existe:** O sistema exibe os dados globais encontrados (nome, e-mail, data de nascimento, foto) e solicita confirmação do Atendente. Ao confirmar, cria apenas o registro local do tenant com o `global_customer_id` vinculado.
    *   **Cliente novo:** Cria o registro global no schema `public` e em seguida cria o registro local do tenant.
*   **Isolamento obrigatório:** Pontos, comandas abertas, saldo devedor, filiação e histórico de consumo são **exclusivos do schema de cada tenant**. Jamais são compartilhados, transferidos ou visíveis entre arenas distintas.
*   **Opt-in LGPD por arena:** O consentimento para recebimento de comunicações via WhatsApp é registrado individualmente por arena (tenant). Um cliente pode ter opt-in ativo na Arena A e opt-out na Arena B.
*   A data de nascimento é registrada para alimentar as campanhas de aniversário automáticas do CRM (ver `CRM-01`).
*   O sistema deve fornecer uma busca indexada rápida por nome parcial ou WhatsApp na tela de abertura de comanda do PDV.

---

## CAD-02 [P0] — Cadastro de Produtos da Copa e Estoque
**Descrição:**
Como administrador, quero cadastrar produtos da copa com preço, categoria e estoque, para vender no PDV com controle de estoque integrado.

**Critérios de Aceite:**
*   Cada produto deve ter: nome, código de barras (opcional), preço de venda (armazenado em centavos/integer), categoria (bebidas, lanches, acessórios, etc.), quantidade em estoque atual e limite de estoque mínimo.
*   **Alteração de preço:** A atualização do preço de venda de um produto no catálogo altera apenas os **novos lançamentos futuros** no PDV. Itens já registrados em comandas abertas ou fechadas preservam o preço vigente no momento em que foram lançados (snapshot imutável — ver `PDV-02`). Não há retroatividade de preço.
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

## CAD-05 [P0] — Cadastro da Grade de Horários e Precificação da Quadra
**Descrição:**
Como administrador da arena, quero cadastrar o horário de funcionamento do clube (abertura e fechamento), a divisão de slots em blocos de 30 minutos e precificar essas frações com seleção rápida de múltiplos dias da semana, para abrir a agenda para locações e reservas de forma ágil e prática.

**Critérios de Aceite:**
*   **Seleção em Lote de Dias da Semana (UX Otimizada):** Permitir selecionar múltiplos dias da semana de uma só vez (ex.: `[x] Seg [x] Ter [x] Qua [x] Qui [x] Sex`) para aplicar a mesma regra de funcionamento e preço em massa, sem necessidade de cadastrar dia por dia.
*   **Horário de Funcionamento e Abertura/Fechamento:** Permitir definir o horário de abertura (ex.: `08:00`) e o horário de fechamento da arena (ex.: `22:00`).
*   **Grade Modularizada em Slots de 30 Minutos:** O sistema gera automaticamente a grade dividida em blocos fixos de 30 em 30 minutos (ex.: 08:00–08:30, 08:30–09:00, etc.).
*   **Precificação por Fração de 30 Minutos (Avulso vs. Mensalista):** A tarifa cadastrada no sistema é expressa por fração de 30 minutos e permite definir dois valores distintos por bloco:
    *   *Tarifa Avulsa (Regular):* Preço padrão praticado para locações pontuais (ex.: R$ 35,00 por fração no horário nobre).
    *   *Tarifa Mensalista:* Preço promocional/diferenciado por fração aplicável a contratos mensalistas recorrentes (ex.: R$ 25,00 por fração no mesmo horário nobre).
    *   *Cálculo Acumulado:* Uma locação de 60, 90 ou 120 minutos consome respectivamente 2, 3 ou 4 blocos e calcula o valor total acumulado segundo a modalidade escolhida (Avulsa ou Mensalista).
*   **Bloqueio de Horários/Quadras:** Permitir o bloqueio de slots individuais de 30 minutos ou da quadra inteira para manutenção, torneios ou eventos corporativos, impedindo reservas públicas e presenciais nesses blocos.
*   **Sincronização em Tempo Real:** Alterações na grade e bloqueios refletem instantaneamente no PDV físico de caixa (`PDV-05`) e na página pública de reservas online (`RES-01`).

---

## CAD-06 [P1] — Atualização de Dados Globais, Área do Atleta e Exclusão (LGPD)
**Descrição:**
Como cliente, quero poder atualizar meus dados pessoais globais (nome, e-mail, foto) através da Área do Atleta, pelo WhatsApp ou via Atendente em qualquer arena, e ver o histórico de comandas/pontos da arena atual; e solicitar a exclusão completa do meu registro (LGPD).

**Critérios de Aceite:**
*   **Área do Atleta (Portal Web):** O cliente possui uma página própria de autoatendimento (ex.: `arena-x.sistema.com.br/atleta` ou portal global). O cliente pode autenticar-se (via OTP WhatsApp/Magic Link) para:
    *   Atualizar dados pessoais globais (nome, e-mail, data de nascimento, foto).
    *   Visualizar o histórico de suas comandas e extrato de consumo daquela arena específica (isolado).
    *   Consultar seu saldo de pontos/cashback daquela arena (`PTS-03`).
    *   Reservar quadras (`RES-01`).
*   **Atualização global:** Quando o próprio cliente (na Área do Atleta ou pelo WhatsApp), ou um Atendente/Gerente no PDV atualiza dados globais, as alterações são salvas no schema `public.global_customers` e refletidas automaticamente no perfil do cliente em todas as arenas.
*   **Campos locais não são propagados:** Opt-in de WhatsApp, nível de fidelidade e preferências de cada arena permanecem exclusivamente no schema local do tenant.
*   **Direito ao Esquecimento (LGPD):** O Admin pode registrar uma solicitação de exclusão global do cliente. O sistema deve:
    1. Remover o registro global do schema `public`.
    2. Remover (ou anonimizar) os registros locais do cliente em todos os tenants onde ele estava vinculado.
    3. Registrar a data e o canal da solicitação de exclusão em log de auditoria permanente (o registro do pedido de exclusão deve ser preservado, não excluído).
    4. Enviar confirmação ao e-mail do cliente (se disponível) de que a exclusão foi processada.

---

## CAD-07 [P0] — Configurações de Impressão Térmica do Tenant
**Descrição:**
Como administrador da arena, quero configurar os parâmetros da impressora térmica do PDV (tamanho do papel e comportamento padrão de impressão), para que as fichas de produção e os comprovantes sejam impressos no formato correto da arena.

**Critérios de Aceite:**
*   **Tamanho do Papel da Impressora:** Permitir escolher entre `58mm` e `80mm` (padrão do sistema: `80mm`). O layout CSS dos comprovantes (`@media print`) deve adaptar dinamicamente suas margens e larguras conforme essa configuração.
*   **Modo Padrão de Impressão no Lançamento:** Permitir configurar uma flag booleana `auto_print_production_tickets` ("Imprimir fichas de produção automaticamente ao lançar itens no PDV"). Quando habilitada, o PDV aciona a impressão de fichas de produção imediatamente após o lançamento sem exigir confirmação adicional do operador.
*   **Personalização de Cabeçalho e Rodapé:** Permitir configurar o texto de cabeçalho (ex.: Nome Fantasia da Arena, CNPJ) e mensagem de rodapé (ex.: "Obrigado pela preferência!", regras de troca ou QR Code de avaliação) impressos nos comprovantes consolidados de comanda.

---

## CAD-08 [P0] — Perfil 360° e Histórico Consolidado do Cliente
**Descrição:**
Como Atendente, Gerente ou Administrador da arena, quero visualizar um painel consolidado (Visão 360°) ao clicar no perfil de um cliente, para consultar instantaneamente seu histórico de compras, débitos pendentes, saldo de aulas, pontuação de fidelidade e frequência de uso de quadras, permitindo um atendimento personalizado e cobranças assertivas.

**Estrutura da Interface (Cards e Seções do Painel):**
1. **Cabeçalho / Resumo do Perfil:**
   - **Identificação:** Foto de perfil (se houver), Nome completo, WhatsApp (com atalho para iniciar conversa no WhatsApp Web/App), E-mail e Data de Nascimento.
   - **Badges de Status:**
     - *Identidade Global:* Indicador se o cliente é vinculado a `global_customers` (`CAD-01`).
     - *Opt-in LGPD:* Indicador visual de consentimento para mensagens via WhatsApp na arena atual (Ativo / Inativo).
     - *Status de Filiação:* Badge destacado se for filiado ativo (ex.: Filiado VIP - Desconto de 10% ativo — `FIL-01`).
     - *Aniversariante do Mês/Dia:* Destaque visual se o aniversário estiver próximo para facilitar abordagens promocionais (`CRM-01`).

2. **Barramento de Indicadores Chave (Cards de Resumo Financeiro e Saldos):**
   - **Saldo Devedor / Conta da Arena (`PDV-11`):** Valor monetário acumulado pendente de pagamento (R$). Se > R$ 0,00, exibe card em alerta vermelho. Informações complementares: Limite máximo permitido na arena e percentual utilizado (ex.: R$ 150,00 / Limite R$ 200,00). Ação rápida: Botão "Quitar Saldo Devedor" (abre fluxo de pagamento no PDV).
   - **Programa de Fidelidade e Cashback (`PTS-01` / `PDV-08`):** Saldo atual em Pontos e conversão direta em Reais (R$) (ex.: 1.500 pts ≈ R$ 15,00). Ação rápida: Botão "Extrato de Pontos" ou "Ajuste Manual de Pontos" (requer Gerente/Admin).
   - **Saldo de Pacotes de Aulas (`PDV-06`):** Quantidade de aulas restantes disponíveis (ex.: 3 de 8 aulas restantes). Ação rápida: Botão "Debitar 1 Aula" ou "Comprar Novo Pacote".
   - **Resumo de Consumo Histórico (LTV):** Total acumulado gasto pelo cliente na arena (R$) e quantidade total de comandas e locações realizadas.

3. **Abas Detalhadas de Histórico (Timeline e Tabelas):**
   - **Aba 1: Comandas e Vendas (`PDV`):** Listagem cronológica de todas as comandas do cliente na arena atual (abertas e fechadas). Colunas: Data/Hora, Código da Comanda, Qtd. de Itens, Valor Total, Meio(s) de Pagamento e Status. Detalhes expansíveis com snapshot dos itens. Ações: "Reimprimir Extrato Consolidado" (`PDV-12`) ou "Ver Comanda Ativa" (`PDV-04`).
   - **Aba 2: Locações de Quadra e Reservas (`RES-01` / `PDV-05`):** Próximos Agendamentos e Histórico de Locações passadas com estatística de modalidade favorita.
   - **Aba 3: Frequência e Histórico de Aulas (`PDV-06`):** Extrato de débitos/aquisições de pacotes de aulas e registro de presença.
   - **Aba 4: Saldo Devedor e Extrato de Cobrança (`PDV-11`):** Detalhamento da origem do saldo devedor e histórico de amortizações.

4. **Ações Rápidas do Gestor (Quick Action Bar):**
   - ➕ **Abrir Nova Comanda:** Direciona para a interface de adição de itens vinculada ao cliente (`PDV-02`).
   - 📅 **Reservar Quadra:** Abre a grade de horários com o cliente pré-selecionado (`PDV-05`).
   - 💳 **Receber Débito Pendente:** Inicia a cobrança direta no PDV (`PDV-11`).
   - ✏️ **Editar Dados Globais/Locais:** Abre edição de dados do cliente (`CAD-01`/`CAD-06`).

**Critérios de Aceite:**
*   **Acesso Rápido a partir de Qualquer Ponto do Sistema:** Ao clicar no nome ou foto do cliente em qualquer tela (Grade de Comandas `PDV-04`, Busca do PDV `PDV-02`, Grade de Quadras `PDV-05` ou Relatórios de Clientes `CAD-01`), o sistema abre o modal/painel lateral do Perfil 360° do Cliente.
*   **Isolamento de Dados por Tenant (Arena):** Histórico de compras, comandas, pontos, saldo devedor e reservas são estritamente restritos à arena atual (tenant).
*   **Sincronização do Saldo Devedor com Bloqueios:** Se o saldo devedor atual exceder o limite configurado pela arena, a tela exibe um aviso visual destacando o bloqueio de novas comandas/reservas (`PDV-11`).
*   **Consistência e Imutabilidade de Histórico:** O detalhamento de comandas passadas exibe os valores históricos do momento da compra (`PDV-02`).
*   **Desempenho:** O carregamento das informações consolidadas abre em menos de 1 segundo.

> **Nota de escopo (Fase 1) — Decisão (2026-08-10):** entregue nesta fase o que
> não depende de módulos ainda não implementados. Itens abaixo permanecem no AC
> como alvo, mas foram ajustados/adiados na Fase 1:
> - **Aba "Locações e Reservas"** e **badge "Status de Filiação":** entregues como
>   placeholder "em breve" — dependem de RES-01/PDV-05 (reservas) e FIL-01
>   (filiação), ainda não implementados.
> - **Registro de presença por aula** e **extrato de amortizações de débito:** fora
>   da Fase 1. A aba de Aulas mostra os saldos atuais e a aba de Saldo Devedor
>   mostra os débitos pendentes.
> - **Acesso "de qualquer ponto do sistema":** na Fase 1 o Perfil 360° é uma **rota
>   dedicada** (`/customers/[id]`) e o nome do cliente é clicável na lista de
>   clientes. A instrumentação de um modal/painel lateral disparável das demais
>   telas (PDV-04, grade de quadras) fica para um passo dedicado.
> - **Limite de saldo devedor:** usa a constante global `CUSTOMER_DEBIT_LIMIT_CENTS`
>   (R$ 200,00); limite configurável por arena depende da config de PDV-11 (não
>   implementada).
> - **Guarda de acesso:** a rota usa `requireSession()` (autenticado), consistente
>   com o restante da área de clientes; padronização para `requireModule("crm")`
>   fica como follow-up.

---

## CAD-09 [P1] — Gestão de Horários Mensalistas e Locação Recorrente
**Descrição:**
Como administrador da arena, quero cadastrar contratos de horários mensalistas para locação fixa e recorrente de quadras, garantindo o cálculo automático da quantidade exata de semanas no mês vigente e a cobrança/renovação antecipada.

**Critérios de Aceite:**
*   **Contrato de Mensalista:** Permite vincular um cliente a um horário fixo de quadra em dia(s) específico(s) da semana (ex.: toda Segunda-feira das 19:00 às 20:30 na Quadra 01).
*   **Cálculo Automático de Ocorrências do Mês:** Ao gerar o lançamento da mensalidade no início do mês, o sistema calcula dinamicamente o número exato de ocorrências daquele dia da semana no mês vigente (ex.: 4 segundas-feiras em Fevereiro vs. 5 segundas-feiras em Março).
*   **Precificação Consolidada com Tarifa Mensalista:** O valor cobrado no mês é calculado multiplicando a quantidade de ocorrências do mês pela **Tarifa Mensalista** cadastrada para aqueles blocos de 30 minutos (`[Ocorrências no Mês] × [Soma das Tarifas Mensalistas das frações]`). Se não houver tarifa mensalista específica cadastrada, o sistema utiliza por padrão a tarifa avulsa da grade.
*   **Integração e Quitação:** O valor da mensalidade pode ser pago antecipadamente no início do mês ou lançado na comanda/saldo devedor do cliente responsável.
*   **Reserva Recorrente da Grade:** A criação/renovação do mensalista reserva automaticamente todas as datas correspondentes daquele mês na grade do PDV (`PDV-05`) e bloqueia a agenda pública online (`RES-01`).
*   **Alerta de Fim de Mês e Renovação:** Na última sessão do mês vigente, o sistema exibe no PDV um destaque de término do ciclo ("Última locação do mês") e gera uma pendência de confirmação/renovação para o mês subsequente.
