# Épico E1 — Plataforma SaaS e Multi-tenancy

Este épico abrange os requisitos para a fundação multi-tenant do sistema, provisionamento de arenas, controle de acesso de usuários corporativos, segurança e o faturamento das mensalidades do próprio SaaS.

---

## SAAS-01 [P0] — Isolamento e Provisionamento de Tenants
**Descrição:**
Como operador do SaaS, quero provisionar uma nova arena (tenant) com base de dados isolada, para garantir separação total dos dados entre clientes.

**Critérios de Aceite:**
*   A criação de um novo tenant deve provisionar automaticamente um schema Postgres dedicado (`tenant_<slug>`), com a estrutura de tabelas padrão e um usuário administrador inicial configurado.
*   O backup e a restauração de dados devem ser possíveis de forma isolada por tenant (via dump do schema específico).
*   Nenhuma consulta, relatório ou API no sistema pode misturar ou retornar dados de múltiplos tenants. Rotas de cada arena devem ser acessadas por subdomínio próprio (ex: `arena-x.sistema.com.br`) ou validadas pelo tenant atrelado à sessão.

---

## SAAS-02 [P0] — Perfis de Acesso e Usuários
**Descrição:**
Como administrador da arena, quero criar e gerenciar usuários com perfis de acesso (Administrador, Caixa, Marketing), para que cada função veja apenas o que precisa.

**Critérios de Aceite:**
*   Devem existir perfis predefinidos que controlam o acesso a nível de tela e ações permitidas:
    *   **Administrador:** Acesso irrestrito às configurações de pontos, relatórios, auditoria e cadastros.
    *   **Caixa:** Acesso exclusivo ao PDV, comandas, abertura/fechamento de caixa e locação de quadras. Ações sensíveis (estornos, sangrias) exigem aprovação/permissão de Administrador.
    *   **Marketing:** Acesso ao CRM, criação de campanhas e configurações de pontos/benefícios.
*   Usuários podem ser inativados/suspensos pelo administrador da arena, bloqueando o login imediatamente sem apagar o histórico de ações que o usuário realizou (preservando integridade física e de auditoria).

---

## SAAS-03 [P0] — Autenticação e Recuperação de Credenciais
**Descrição:**
Como usuário, quero autenticar com e-mail e senha e recuperar a senha sozinho, para acessar o sistema com segurança.

**Critérios de Aceite:**
*   Armazenamento seguro de senhas no banco com algoritmo de hash forte (ex: bcrypt ou argon2).
*   Bloqueio temporário de login por IP ou e-mail após 5 tentativas consecutivas falhas.
*   Mecanismo de "esqueci minha senha" que envia um link com token temporário e de uso único (expiração em até 24 horas) para o e-mail cadastrado do usuário.

---

## SAAS-04 [P1] — Controle Comercial de Tenants
**Descrição:**
Como operador do SaaS, quero ativar, suspender e cancelar tenants, para gerir a operação comercial do sistema.

**Critérios de Aceite:**
*   A suspensão de um tenant impede o login de todos os seus usuários da arena associada imediatamente.
*   Ao tentar acessar o sistema suspenso, deve ser exibida uma tela informativa ("Assinatura Suspensa").
*   Os dados do tenant devem ser preservados intactos no banco de dados durante a suspensão. O cancelamento definitivo marca o schema para arquivamento ou exclusão programada.

---

## SAAS-05 [P1] — Logs de Auditoria de Ações Sensíveis
**Descrição:**
Como administrador da arena, quero um log de auditoria das ações sensíveis realizadas no sistema, para rastrear a operação e prevenir fraudes.

**Critérios de Aceite:**
*   Toda ação sensível (sangria/suprimento de caixa, desconto manual, estorno de comanda, cancelamento de reserva e alteração de parâmetros do sistema) deve gerar um registro inalterável de auditoria.
*   O log de auditoria deve conter: ID do usuário (quem), data/hora (quando), tipo de ação (o quê), dados anteriores e posteriores (contexto/valores) e a justificativa fornecida pelo operador.
*   Apenas usuários com perfil Administrador têm acesso à visualização do relatório de auditoria.

---

## SAAS-06 [P2] — Login Próprio de Professores (v2)
**Descrição:**
Como professor da arena, quero ter um login próprio (perfil Professor) para consultar minhas turmas, alunos e horários de aulas.

**Critérios de Aceite:**
*   *Nota: Escopo v2 (P2).* No v1, a operação e agendamento de aulas são gerenciadas inteiramente pelo caixa ou administrador.
*   O professor poderá visualizar a agenda de quadras com foco apenas em suas turmas e alunos atrelados.
*   Não deve ter acesso ao caixa, faturamento global da arena ou dados de faturamento de outros professores.

---

## SAAS-07 [P0] — Painel Backoffice Central do SaaS
**Descrição:**
Como operador do SaaS, quero um painel administrativo central (backoffice), separado dos tenants, para administrar as arenas, planos e assinaturas.

**Critérios de Aceite:**
*   O painel de backoffice deve ser acessado por um domínio/rota administrativa restrita e com autenticação separada dos tenants padrão.
*   Permitir cadastro e edição de planos comerciais do SaaS, definindo: valor mensal da assinatura, período de carência (ex.: 12 meses) e módulos do sistema habilitados.
*   Listar todas as arenas cadastradas exibindo: plano contratado, status (ativa/suspensa/cancelada), data de ativação e início do faturamento.
*   Exibir métricas consolidadas de uso por arena (quantidade de usuários ativos, comandas fechadas por mês e total de notificações de WhatsApp enviadas).

---

## SAAS-08 [P1] — Faturamento Automatizado de Assinaturas (Asaas)
**Descrição:**
Como operador do SaaS, quero cobrança automática das assinaturas das arenas via Asaas com painel de inadimplência, para gerir a receita sem trabalho manual.

**Critérios de Aceite:**
*   Integração com gateway de pagamentos Asaas para emitir faturas recorrentes de planos contratados ao final do período de carência de cada tenant.
*   Envio automático de alertas de cobrança por e-mail/WhatsApp antes e após o vencimento.
*   Em caso de inadimplência prolongada (parâmetro configurável, ex: 15 dias de atraso), o sistema deve suspender o tenant automaticamente (conforme `SAAS-04`).
