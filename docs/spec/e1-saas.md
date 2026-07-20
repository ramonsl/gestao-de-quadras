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
Como administrador da arena, quero criar e gerenciar usuários com perfis de acesso (Admin, Gerente, Atendente), para que cada função veja apenas o que precisa.

> Decisão (2026-07-19): Perfis renomeados de `Administrador / Caixa / Marketing` para `Admin / Gerente / Atendente`, com controle de módulos por perfil configurável.

**Critérios de Aceite:**
*   Devem existir três perfis predefinidos que controlam o acesso a nível de módulo e ações permitidas:
    *   **Admin:** Acesso irrestrito a todos os módulos e configurações. Único perfil autorizado a acessar Auditoria, Configurações da Arena (`SAAS-09`), Planos de Filiação e dados financeiros consolidados.
    *   **Gerente:** Acesso a todos os módulos operacionais (PDV, Quadras/Grade, CRM, Filiação, Pontos, Publicidade, Relatórios, WhatsApp). Não acessa Configurações da Arena, Auditoria Financeira nem gerenciamento de usuários.
    *   **Atendente:** Acesso restrito ao PDV e à grade de quadras. Pode lançar itens em comandas e realizar locações. Cancelamentos e estornos exigem autorização explícita de Gerente ou Admin (ver `PDV-09`).
*   A **matriz de módulos por perfil é configurável por arena** pelo Admin (ver `SAAS-10`): é possível, por exemplo, habilitar o módulo de CRM para Atendentes ou desabilitar Publicidade para Gerentes.
*   Usuários podem ser inativados/suspensos pelo Admin da arena, bloqueando o login imediatamente sem apagar o histórico de ações que o usuário realizou (preservando integridade física e de auditoria).

---

## SAAS-03 [P0] — Autenticação e Recuperação de Credenciais
**Descrição:**
Como usuário da arena, quero autenticar com e-mail/usuário e senha, para acessar o sistema de forma segura, com suporte a fluxos de recuperação específicos dependendo da presença de e-mail.

**Critérios de Aceite:**
*   **Tela de Login:** Cada arena possui uma tela de login dedicada acessível pelo subdomínio do tenant (ex.: `arena-x.sistema.com.br/login`). Aceita login por `username` ou `email`. Esta tela é completamente separada do login do backoffice Core (`SAAS-11`).
*   **Armazenamento seguro:** Senhas armazenadas com algoritmo de hash forte (bcrypt ou argon2). Nenhuma senha é armazenada em texto plano.
*   **Bloqueio de tentativas:** Bloqueio temporário por IP, e-mail ou username após 5 tentativas consecutivas falhas com desbloqueio automático após 15 minutos.
*   **Primeiro acesso:** 
    *   **Com e-mail:** O usuário recebe um e-mail com link de ativação (expira em 48h). Ao clicar, define sua própria senha.
    *   **Sem e-mail (operador local):** O login é habilitado imediatamente com a senha definida pelo Admin no cadastro (conforme `SAAS-12`). Recomenda-se exigir a alteração no primeiro login.
*   **Sessão autenticada:** O token de sessão (JWT ou cookie seguro) deve conter: `tenantId`, `userId`, `role` e `modulesAllowed` (lista dos módulos liberados para o usuário/perfil na arena).
*   **Recuperação de senha:** 
    *   **Com e-mail:** Link de redefinição enviado para o e-mail cadastrado (token único, expira em 24h).
    *   **Sem e-mail:** A redefinição é efetuada diretamente pelo Administrador da arena na tela de gestão de usuários (conforme `SAAS-12`).

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

---

## SAAS-09 [P0] — Configuração e Personalização da Arena
**Descrição:**
Como Admin da arena, quero configurar as informações, identidade visual e parâmetros operacionais da minha arena no sistema, para que ela reflita minha marca e meu horário de funcionamento em todos os pontos de contato com o cliente.

**Critérios de Aceite:**
*   **Identidade:** Permitir upload de **logo** (formatos PNG ou SVG, tamanho máximo de 2MB). A logo é exibida no PDV, nas notificações de WhatsApp (como assinatura da mensagem) e na página pública de reservas.
*   **Dados da Arena:** Configurar nome de exibição, endereço completo, telefone de contato e e-mail administrativo.
*   **Fuso Horário e Funcionamento:** Configurar o fuso horário da arena e o horário padrão de funcionamento (usado como referência para a grade de quadras de `CAD-05` e para o agendamento de envios automáticos do CRM).
*   **Tema da Página Pública:** Personalizar a cor primária e secundária exibidas na página pública de reservas do tenant (`RES-01`).
*   **Moeda:** Configuração padrão `pt-BR / R$`. Exibição consistente em todas as telas do sistema sem permitir alteração de moeda no v1.
*   Apenas o perfil **Admin** tem acesso a esta tela de configuração.
*   Toda alteração nestas configurações gera registro de auditoria (`SAAS-05`).

---

## SAAS-10 [P0] — Matriz de Permissões por Módulo e Perfil
**Descrição:**
Como Admin da arena, quero configurar quais módulos do sistema cada perfil (Gerente e Atendente) pode acessar, para personalizar o fluxo de trabalho de acordo com a operação da minha arena.

**Critérios de Aceite:**
*   O Admin pode habilitar ou desabilitar o acesso a cada módulo individualmente para os perfis **Gerente** e **Atendente**. O perfil **Admin** tem acesso irrestrito e não pode ser restringido.
*   **Módulos configuráveis:** PDV, Quadras/Grade de Locação, CRM, Filiação, Pontos/Cashback, Publicidade, Relatórios/Dashboard, Configurações de WhatsApp.
*   **Templates padrão ao criar a arena:**
    *   Gerente: todos os módulos habilitados exceto Configurações da Arena e Auditoria.
    *   Atendente: apenas PDV e Quadras/Grade habilitados por padrão.
*   A sessão de cada usuário ao fazer login deve refletir imediatamente a matriz de permissões vigente no momento do login. Alterações na matriz pelo Admin **não** invalidam sessões ativas — entram em vigor no próximo login do usuário afetado.
*   Toda alteração na matriz de permissões gera registro de auditoria (`SAAS-05`).

---

## SAAS-11 [P0] — Login e Autenticação do Backoffice SaaS (Core)
**Descrição:**
Como operador do SaaS (Super Admin ou Suporte), quero um login dedicado e separado para o painel Core de administração do SaaS, para gerenciar arenas e assinaturas com segurança máxima.

**Critérios de Aceite:**
*   O painel Core é acessado exclusivamente pela URL `admin.sistema.com.br` (ou rota administrativa equivalente). Não há nenhuma vinculação ou acesso cruzado com os logins de arenas individuais.
*   **Perfis do Core:**
    *   **Super Admin:** Acesso irrestrito a todas as funções do painel Core (criar arenas, suspender tenants, editar planos, visualizar métricas).
    *   **Suporte:** Acesso somente-leitura para fins de diagnóstico (visualizar dados de tenants, histórico de erros, status de conexões WhatsApp). Não pode criar, editar ou excluir recursos.
*   **MFA Obrigatório:** O perfil Super Admin deve obrigatoriamente ativar autenticação de dois fatores via aplicativo TOTP (ex: Google Authenticator) antes do primeiro acesso ao painel Core. Login sem MFA configurado é bloqueado.
*   As credenciais de acesso ao Core são armazenadas no schema `public` do banco de dados, completamente separadas das credenciais dos usuários dos tenants.

---

## SAAS-12 [P0] — Cadastro e Gestão de Usuários Operacionais da Arena

> **Decisão (2026-07-19):** Operadores da arena são entidades **do tenant** — suas credenciais vivem em `tenant_<slug>.users_tenants`, não em `public.users` (reservado a identidades globais: atletas/CAD-01 e backoffice/SAAS-11). O login resolve o tenant pelo subdomínio (SAAS-03) e autentica dentro do schema da arena. Senha mínima unificada em **8** caracteres (igual aos fluxos por token).

**Descrição:**
Como Admin da Arena, quero cadastrar e gerenciar os operadores da minha arena (mesmo sem e-mail), definindo perfil e os módulos permitidos, para dar suporte à operação de caixa e atendimento com acessos individuais.

**Critérios de Aceite:**
1. **Isolamento de Tenant:** O Admin só visualiza, cria e gerencia operadores da própria arena (schema do tenant da sessão). Nenhum acesso a operadores de outra arena.
2. **Permissão:** Apenas o perfil **Admin** acessa a gestão de usuários; Gerente e Atendente são bloqueados (redirecionados). Toda ação é auditada.
3. **Campos do usuário:**
   - **Nome completo (`name`)** — obrigatório.
   - **Usuário / login (`username`)** — obrigatório, único no tenant, identificador de login.
   - **Senha inicial (`password`)** — obrigatória, mínimo 8 caracteres, definida pelo Admin no cadastro.
   - **E-mail (`email`)** — opcional; quando presente, habilita recuperação de senha por e-mail (SAAS-03).
   - **Telefone (`phone`)** — opcional.
   - **Status** — ativo/inativo.
4. **Autenticação flexível:** a tela de login aceita `username` OU `email`.
5. **Matriz de módulos por usuário (`modulesAllowed`):** ao criar/editar, o Admin seleciona os módulos: PDV, Quadras/Grade, CRM, Filiação, Pontos, Publicidade, Relatórios, Configurações de WhatsApp. O Admin tem acesso irrestrito (não é limitado pela seleção). *Configurações da Arena (SAAS-09) é sempre exclusiva do Admin e não entra na matriz.*
6. **Login imediato:** o operador loga assim que criado, com username + senha do Admin — sem etapa de ativação por e-mail.
7. **Troca de senha no primeiro acesso (configurável):** opção por usuário (`mustChangePassword`), marcada pelo Admin; padrão da arena definido em SAAS-09.
8. **Edição:** o Admin altera nome, e-mail, telefone, perfil e módulos. Mudança de perfil/módulos vale no próximo login do afetado (SAAS-10). O `username` não é alterável.
9. **Redefinição de senha pelo Admin:** substitui a recuperação por e-mail para operadores sem e-mail; zera bloqueio/tentativas; auditada.
10. **Inativação (não exclusão):** operadores são inativados (login bloqueado imediatamente), preservando o histórico de auditoria; o Admin pode reativar.
11. **Autoproteção:** não é possível inativar nem rebaixar o **último Admin ativo** da arena.
12. **Auditoria:** criação, edição, alteração de módulos, reset de senha e inativação/reativação geram registro em `audit_logs` do tenant (ator = Admin executor).
13. **Listagem:** nome, usuário/login, perfil, módulos, status e último acesso; com busca.

