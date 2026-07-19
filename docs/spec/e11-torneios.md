# Épico E11 — Torneios (versão futura)

Este épico reúne as especificações de torneios internos e externos na arena. Embora classificado como escopo para versão v2 (P2) e fora do MVP da Fase 1, as decisões atuais de arquitetura e cadastros básicos (clientes, quadras e horários) devem prever sua futura integração sem retrabalho.

---

## TOR-01 [P2] — Criação de Torneios, Inscrições e Chaveamento
**Descrição:**
Como administrador da arena, quero criar torneios com categorias e chaveamento automático, para organizar competições esportivas.

**Critérios de Aceite:**
*   *Nota: Escopo v2 (P2).*
*   Permitir criar torneios configurando: nome, modalidades (ex.: Masculino A, Misto B), datas, limite de duplas/atletas e valor de inscrição.
*   **Inscrição de Clientes:** A ficha de inscrição deve reutilizar diretamente os dados de clientes cadastrados no sistema (`CAD-01`). O pagamento da taxa de inscrição pode ser feito via PDV ou boleto/Pix emitido pelo Asaas.
*   **Geração de Chaves:** O sistema deve gerar chaves de chaveamento clássicas (grupos + eliminatórias ou mata-mata simples) de forma automatizada com base nas duplas inscritas.
*   **Reserva de Quadras:** As partidas geradas pelo chaveamento devem ocupar e bloquear automaticamente os horários de quadras correspondentes na grade geral de reservas (`CAD-05` / `RES-01`), evitando qualquer conflito com locações avulsas ou aulas recorrentes.

---

## TOR-02 [P2] — Visualização de Chaves, Jogos e Resultados
**Descrição:**
Como atleta/cliente, quero visualizar o andamento das chaves de torneios, meus horários de jogos e resultados atualizados na página pública ou receber notificações via WhatsApp.

**Critérios de Aceite:**
*   *Nota: Escopo v2 (P2).*
*   Disponibilizar uma aba pública de Torneios na página da arena (ex.: `arena-x.sistema.com.br/torneios`) exibindo de forma interativa o chaveamento gráfico, cronograma de jogos e tabela de classificação.
*   Ao atualizar o resultado de uma partida no painel administrativo, a chave pública é recalculada instantaneamente e as duplas vencedoras avançadas de fase.
*   O sistema envia notificações automáticas via WhatsApp (com base no opt-in cadastrado) aos participantes informando os horários, quadras e adversários dos seus próximos jogos.
