# Épico E8 — Notificações WhatsApp (transversal)

Este épico define a infraestrutura e os fluxos de envio de mensagens e notificações via WhatsApp, que representam o principal diferencial central de transparência e engajamento do Arena SaaS.

---

## WPP-01 [P0] — Conexão de Número WhatsApp (Baileys)
**Descrição:**
Como administrador, quero conectar o número de WhatsApp da minha arena ao sistema (via QR Code), para que as mensagens saiam do telefone da própria arena, sem custo por mensagem.

**Critérios de Aceite:**
*   **Integração e Abstração:** O envio de mensagens deve ser inteiramente abstraído sob a interface `MessagingProvider` em `packages/messaging`. Nenhuma dependência da biblioteca Baileys pode ser importada fora desse pacote.
*   **Hospedagem das Sessões (Pool Centralizado):** Para eficiência de recursos, as conexões de todas as arenas são gerenciadas dinamicamente dentro de um pool assíncrono centralizado no mesmo processo do Worker, compartilhando o mesmo runtime Node.js, em vez de criar processos de SO dedicados por arena.
*   **Status de Conexão:** Exibir no painel da arena o status em tempo real da conexão (Conectado, Desconectado, Conectando, QR Code Aguardando Leitura).
*   **Reconexão:** Implementar mecanismo de reconexão automática em caso de quedas de internet locais do chip e enviar alerta ao e-mail do administrador se a sessão for desconectada permanentemente (ex.: se o número for desconectado no celular).

---

## WPP-02 [P0] — Notificação de Lançamento na Comanda e Regras de Agrupamento
**Descrição:**
Como cliente, quero receber uma mensagem no WhatsApp a cada lançamento feito na minha comanda, contendo o item, valor e o total parcial, para ter controle do que estou consumindo.

**Critérios de Aceite:**
*   **Gatilho de Envio:** Lançamentos de produtos ou serviços em comandas de clientes com opt-in ativo disparam uma mensagem em tempo quase real (tempo limite de < 1 min para enfileirar).
*   **Agrupamento Antispam (Janela de 3 Minutos):** Se múltiplos itens forem lançados na mesma comanda em uma janela de 3 minutos (ex.: o caixa lança uma água e logo em seguida uma bolinha de padel), o sistema deve agrupar esses itens em uma única mensagem, evitando spammar o cliente com mensagens consecutivas.
*   **Conteúdo da Mensagem:** A mensagem deve conter: nome do item, quantidade, valor unitário, e o valor total parcial atualizado da comanda do cliente.
*   **Filtro:** Clientes sem opt-in ou consumos em comanda avulsa (sem identificação) não geram mensagens.

---

## WPP-03 [P0] — Cancelamento (Opt-out) e Reativação das Notificações
**Descrição:**
Como cliente, quero poder cancelar (opt-out) ou reativar o recebimento de notificações respondendo ao WhatsApp, para controlar minha comunicação e garantir conformidade com a LGPD.

**Critérios de Aceite:**
*   **Opt-out Automático:** Se o cliente responder ao WhatsApp da arena com a palavra-chave "SAIR" (ou variações como "CANCELAR"), o sistema processa a resposta, desativa imediatamente o opt-in de comunicações no seu cadastro e envia uma última confirmação ("Notificações desativadas. Para voltar a receber envie QUERO").
*   **Opt-in de Retorno:** Caso o cliente envie a palavra-chave "QUERO" (ou "ATIVAR"), o sistema reativa o consentimento e registra a data/hora atualizada do consentimento de comunicação.
*   Toda alteração de consentimento deve salvar a data, hora e o canal da solicitação de alteração no banco de dados.

---

## WPP-04 [P1] — Fila de Envio, Retentativas e Log de Status
**Descrição:**
Como administrador da arena, quero uma fila de envio robusta com retentativas automáticas e log de status, para garantir a confiabilidade e o diagnóstico das mensagens enviadas.

**Critérios de Aceite:**
*   **Fila Assíncrona:** Toda notificação a ser enviada deve ser inserida na fila `notification.queue` (BullMQ + Redis) pelo serviço de negócio. O processamento ocorre de forma assíncrona pelo Worker, nunca síncrona com a requisição do usuário.
*   **Estratégia de Retentativas:** Em caso de erro temporário de rede no envio pelo Baileys, o Worker deve realizar retentativas automáticas (máximo de 3 tentativas) aplicando política de backoff exponencial.
*   **Histórico de Status:** Manter registro do status de cada mensagem (Na Fila, Enviado, Entregue, Erro no Envio com a descrição da falha) associado ao cliente e à comanda de origem.

---

## WPP-05 [P1] — Menu Interativo de Autoatendimento do Cliente no WhatsApp
**Descrição:**
Como cliente da arena, quero interagir com o WhatsApp oficial da arena enviando palavras-chave ou acessando um menu de opções, para consultar minha comanda aberta, saldo devedor, meus pontos de fidelidade, atualizar dados ou reservar quadras sem precisar falar com o atendente.

**Critérios de Aceite:**
*   **Menu de Opções Responde ao Cliente:** Quando o cliente envia uma mensagem como "MENU", "AJUDA" ou "COMANDA", o sistema responde com um menu numerado ou botões de opções:
    1. 📄 *Ver minha comanda / extrato da arena* (exibe os itens lançados e o total parcial da comanda aberta na arena atual).
    2. 🪙 *Meus pontos de fidelidade / cashback* (exibe os pontos acumulados e a expiração na arena atual).
    3. ✏️ *Atualizar meus dados pessoais* (retorna o link direto e seguro da Área do Atleta).
    4. 🎾 *Reservar uma quadra* (retorna o link público de reservas da arena).
*   **Isolamento Estrito:** A resposta do WhatsApp consulta exclusivamente os dados da arena à qual aquele número está conectado. Informações de consumo, faturas e comandas de outras arenas **nunca** são exibidas.
*   **Respostas Rápidas e Idempotentes:** Respostas a mensagens recebidas são processadas por workers em segundo plano e com prevenção contra loops ou envios repetidos em curtos intervalos.
