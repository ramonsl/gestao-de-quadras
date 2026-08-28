# Épico E5 — Filiação (Clube de Benefícios)

Este épico abrange a gestão dos planos de filiação da arena (mensalistas/clubes), a cobrança automatizada via gateway de pagamento (Asaas), relatórios de recorrência e o autoatendimento dos filiados via WhatsApp.

---

## FIL-01 [P0] — Configuração de Planos de Filiação e Benefícios
**Descrição:**
Como administrador da arena, quero configurar planos de filiação, vincular clientes existentes e definir benefícios, para operar o clube de benefícios e aplicar os descontos elegíveis no fechamento das comandas.

**Decisão de produto:** 2026-08-27.

**Critérios de Aceite:**
*   A gestão de planos e filiações é exclusiva do perfil `admin`.
*   A criação do plano exige nome, descrição, preço total do ciclo em centavos inteiros e período de cobrança `monthly`, `semiannual` ou `annual`.
*   O administrador pode editar e inativar um plano, mas não excluí-lo definitivamente. A inativação impede novos vínculos e novos benefícios sem apagar filiações, comandas ou históricos anteriores.
*   O plano permite configurar separadamente:
    *   **Produtos:** percentual de desconto e categorias de produtos elegíveis.
    *   **Locação:** percentual de desconto em locações de quadra.
    *   **Aulas:** percentual de desconto em pacotes de aula. Aula avulsa não faz parte desta US.
*   O vínculo é manual e utiliza a base de clientes da própria arena: qualquer `customer` existente no tenant pode ser vinculado a um plano. O cadastro do cliente não cria uma filiação automaticamente.
*   Cada `customer` pode ter somente uma filiação administrativamente ativa por tenant, inclusive quando a data de início estiver no futuro. Tentativas duplicadas ou concorrentes não podem criar dois vínculos ativos.
*   O vínculo exige data de início e aceita data de término opcional. O status administrativo `active` pode representar uma filiação futura; a elegibilidade para benefícios exige que a data UTC esteja dentro da vigência, incluindo as datas inicial e final.
*   O encerramento manual torna a filiação inativa imediatamente, independentemente da data de término, preservando o histórico.
*   Um benefício somente é elegível quando a filiação está administrativamente ativa, a vigência UTC inclui a data efetiva e o plano está ativo.
*   Quando mais de um desconto puder atingir o mesmo item, aplica-se somente o maior percentual. Percentuais não são acumulados.
*   O desconto é arredondado por linha para o centavo mais próximo pela fórmula `floor((gross * pct + 50) / 100)`; o desconto total é a soma dos descontos das linhas.
*   O cálculo do benefício ocorre exclusivamente no servidor. O fechamento não aceita desconto de filiação nem desconto manual informado pelo cliente ou pela interface.
*   O cálculo usa os snapshots de categoria e preço do item. O fechamento preserva snapshots do percentual e valor descontado por linha, do plano aplicado e dos totais bruto, descontado e líquido, sem alterar o preço original da venda.
*   Alterações ou inativação do plano afetam somente operações futuras. Uma comanda já fechada mantém os snapshots e valores que estavam vigentes em seu fechamento.
*   Antes de fechar a comanda, o PDV exibe uma prévia calculada no servidor e um `settlement token` que representa itens, filiação, plano, descontos e totais. No fechamento, o servidor recalcula a composição sob lock; se o token divergir, nenhuma alteração é persistida e o operador deve confirmar a nova prévia.
*   O fechamento é atômico: snapshots, pagamentos, pontos eventualmente resgatados, créditos de pacotes e auditoria são confirmados ou revertidos em conjunto.
*   Uma comanda com total líquido igual a zero pode ser fechada sem registrar forma de pagamento.
*   A reabertura segue o fluxo da `PDV-09`: o settlement é versionado e sua reversão é atômica e idempotente. A versão anterior permanece no histórico como revertida, seus efeitos reversíveis são desfeitos uma única vez e um novo fechamento cria uma nova versão.
*   Todas as mutações de comanda que possam alterar o settlement participam do mesmo protocolo de concorrência, impedindo que itens, cliente ou benefícios mudem entre o cálculo confirmado e o fechamento.
*   Criação, edição e inativação de plano, vínculo, encerramento, fechamento e reversão geram registro de auditoria com o operador responsável e sem dados pessoais desnecessários.
*   Toda leitura, gravação, vínculo, cálculo, fechamento e reversão valida e filtra explicitamente o `tenant_id`. IDs de outro tenant não podem ser usados para consultar ou vincular clientes, planos, filiações ou comandas.

**Fora do Escopo:**
*   Cobrança ou assinatura via Asaas e gestão de inadimplência (`FIL-02`).
*   Autoatendimento, notificações e carteirinha via WhatsApp (`FIL-03`).
*   Relatórios de recorrência, MRR e churn (`FIL-04`).
*   Prioridade em reservas.
*   Adesão pública ou automática à filiação.
*   Venda ou benefício para aula avulsa.
*   Crédito automático de pontos (`PTS-02`).
*   Desconto manual.

**Roteiro de Teste Manual (QA):**

**Pré-condições:**
*   Ter dois tenants distintos, cada um com usuários `admin`, `gerente` e `atendente`.
*   No tenant principal, ter clientes existentes, categorias e produtos, uma locação, um pacote de aula e uma comanda identificada aberta.
*   Ter uma segunda sessão ou mecanismo equivalente para simular alterações concorrentes.

**Passos e resultados esperados:**
1. Acessar a gestão de filiação como `admin`. A tela deve ser exibida; repetir como `gerente` e `atendente`, que devem receber acesso negado.
2. Criar um plano informando nome, descrição, preço inteiro em centavos, período válido e percentuais distintos para produtos, locação e pacotes. O plano deve ser salvo com os valores informados.
3. Editar o plano. A nova configuração deve ficar disponível apenas para operações futuras, sem modificar históricos fechados.
4. Vincular manualmente um cliente existente com início futuro e sem término. O vínculo deve ficar administrativamente ativo, mas sem conceder benefício antes da data inicial UTC.
5. Tentar criar outra filiação ativa para o mesmo cliente, inclusive em duas sessões simultâneas. Apenas um vínculo deve permanecer ativo e a tentativa conflitante deve falhar sem duplicação.
6. Encerrar manualmente a filiação. O benefício deve deixar de ser elegível imediatamente e o vínculo deve permanecer no histórico.
7. Criar uma filiação vigente e abrir o fechamento da comanda. A prévia deve identificar o plano e mostrar subtotal bruto, descontos por linha e total líquido calculados no servidor.
8. Validar uma comanda com produto elegível, produto não elegível, locação e pacote de aula. Cada tipo deve usar seu percentual próprio; itens desconhecidos e produtos fora das categorias selecionadas não recebem benefício.
9. Configurar duas regras aplicáveis ao mesmo item. O fechamento deve aplicar somente o maior percentual, sem somá-los.
10. Usar um valor que gere fração de centavo. O resultado por linha deve seguir `floor((gross * pct + 50) / 100)`, e o total deve ser a soma das linhas arredondadas.
11. Alterar item, cliente, filiação ou plano após gerar a prévia e antes de confirmar. O token deve divergir, o fechamento não deve persistir efeitos e uma nova confirmação deve ser exigida.
12. Fechar uma comanda elegível. Preço e categoria da venda, desconto por linha, plano e totais devem permanecer como snapshots após editar ou inativar o plano.
13. Fechar uma comanda cujo desconto resulte em total líquido zero. O fechamento deve concluir sem forma de pagamento.
14. Reabrir a comanda conforme `PDV-09`. A versão fechada deve ser marcada como revertida, os efeitos reversíveis devem ser desfeitos uma única vez e o segundo fechamento deve criar uma nova versão.
15. Inativar um plano. Novos vínculos e novos benefícios devem ser bloqueados, enquanto vínculos e comandas históricos permanecem consultáveis.

**Bordas e segurança:**
*   Validar início e fim da vigência nas datas-limite UTC; ambas são inclusivas. Data final anterior à inicial deve ser rejeitada.
*   Validar preço não inteiro, zero ou negativo, período inválido e percentuais fora do intervalo permitido; nenhum plano inválido deve ser criado.
*   Tentar vincular cliente, plano ou comanda pertencente ao segundo tenant. A operação deve falhar sem revelar dados do outro tenant.
*   Simular dois fechamentos concorrentes. Somente um settlement vigente deve ser criado, sem duplicar pagamentos, resgate de pontos, créditos de pacote ou auditoria financeira.
*   Repetir a reabertura da mesma versão. A reversão deve ser idempotente e não pode desfazer pagamentos, pontos ou créditos mais de uma vez.
*   Confirmar que nenhum valor de desconto enviado pela interface altera o cálculo produzido pelo servidor.

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
