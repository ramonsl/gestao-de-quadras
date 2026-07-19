# Épico E10 — Reservas Online de Quadras

Este épico rege a página pública de reservas da arena, permitindo que clientes agendem horários de quadras de forma online direta, além de contemplar sinal/pré-pagamento e políticas de cancelamento.

---

## RES-01 [P0] — Reserva Online pela Página Pública
**Descrição:**
Como cliente, quero reservar uma quadra para uma data futura através da página pública da arena, para garantir meu horário de forma rápida sem precisar telefonar.

**Critérios de Aceite:**
*   **Página Pública Dedicada:** Cada arena (tenant) possui uma página/widget de reservas pública acessível via subdomínio (ex: `arena-x.sistema.com.br/reservar`).
*   **Grade Aberta:** Exibir os horários disponíveis com base no cadastro de grade de horários (`CAD-05`) e nos horários já ocupados ou bloqueados no PDV (`PDV-05`) em tempo real.
*   **Identificação Simples:** A reserva exige que o cliente informe Nome e WhatsApp (com validação estrutural). Ao finalizar a reserva, o sistema envia uma notificação automática via WhatsApp confirmando o agendamento.
*   **Sincronização em Tempo Real:** Uma reserva feita de forma online deve instantaneamente bloquear a grade do PDV da arena, impedindo que o operador de caixa venda o mesmo horário presencialmente (prevenindo duplicidade de marcação).
*   **Integração no Dia:** No dia reservado, a reserva online deve constar como lançamento em comanda do cliente no PDV de forma automática ou com apenas um clique de confirmação do operador de caixa.
*   *Nota de Refinamento:* Conforme decisão alinhada (Opção B), a antecedência de abertura da grade de reservas públicas é igualitária para todos os clientes identificados na v1, sem privilégios diferenciados de antecedência para filiados.

---

## RES-02 [P1] — Pré-pagamento / Sinal da Reserva Online (Pix)
**Descrição:**
Como administrador da arena, quero exigir um sinal/pré-pagamento para confirmação de reservas feitas online via Pix, para reduzir a ocorrência de ausências sem aviso (no-show).

**Critérios de Aceite:**
*   Permitir configurar no painel de administração da arena a exigência de sinal, definindo se será um percentual sobre o valor da quadra (ex.: 50% do valor) ou um valor fixo em centavos (ex.: R$ 40,00).
*   Ao realizar o agendamento online, o sistema gera uma cobrança Pix (via gateway Asaas) e exibe o QR Code / Copie e Cole na tela com prazo de validade curto para expiração (ex.: 15 minutos).
*   O horário escolhido fica reservado temporariamente por 15 minutos. Se o pagamento for confirmado via webhook do Asaas, a reserva é consolidada e confirmada por WhatsApp. Caso expire sem pagamento, o horário é liberado de volta na grade automaticamente.

---

## RES-03 [P1] — Políticas de Cancelamento e No-show Configuráveis
**Descrição:**
Como administrador da arena, quero parametrizar políticas de cancelamento e regras de no-show para reservas públicas, para proteger a agenda e reduzir ociosidade.

**Critérios de Aceite:**
*   Permitir configurar o prazo limite para cancelamento gratuito pelo cliente na página pública (ex.: até 24 horas antes do horário reservado).
*   Se o cancelamento for feito dentro do prazo, o sistema realiza o estorno automático do sinal de Pix pelo Asaas ou gera um crédito de valor (voucher/pontos) para uso futuro.
*   Se o cliente não comparecer (no-show) ou cancelar fora do prazo, o sinal é retido como multa. O sistema registra o no-show no cadastro do cliente. Administradores podem configurar bloqueios temporários de novas reservas online para clientes reincidentes (ex.: após 2 no-shows consecutivos).
