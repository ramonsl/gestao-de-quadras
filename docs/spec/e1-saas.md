# Épico 1: SaaS (Multi-tenancy, Usuários e Backoffice)

Este épico descreve o isolamento de arenas (multi-tenancy), o gerenciamento de usuários de operação e o controle de acesso por módulo.

* **Issue de referência no GitHub:** [Issue #63](https://github.com/ramonsl/gestao-de-quadras/issues/63) (feat(SAAS-12): Cadastro e Gestão de Usuários Operacionais da Arena)

---

## US-SAAS-01: Cadastro Simplificado de Usuários Operadores da Arena

**Como** Gestor de uma Arena  
**Quero** cadastrar usuários operadores para a minha arena de forma simplificada  
**Para que** a equipe local possa operar o sistema no dia-a-dia sem complexidade no registro  

### Critérios de Aceite:
1. **Isolamento de Tenant**: O gestor só pode visualizar, criar e gerenciar usuários vinculados ao seu próprio `tenantId` (sua arena). É proibido listar ou associar usuários a outros tenants.
2. **Campos Obrigatórios**: O formulário de criação de usuário deve exigir apenas:
   - Nome Completo (`name`)
   - Nome de Usuário / Login (`username`) — deve ser único por tenant
   - Senha (`password`) — com no mínimo 6 caracteres
3. **Campos Opcionais**:
   - Email (`email`) — se preenchido, deve ter formato válido e ser único globalmente ou por tenant
   - Telefone (`phone`) — se preenchido, deve ser formatado corretamente
4. **Perfil padrão**: Usuários criados por essa funcionalidade recebem inicialmente o papel/função operacional limitado pelas permissões selecionadas.
5. **Logs de Auditoria**: Qualquer novo usuário criado deve gerar um registro na tabela de auditoria (`audit_logs`) do respectivo tenant contendo o ID do gestor que realizou a ação, a data/hora e o ID do usuário criado.

---

## US-SAAS-02: Gestão de Permissões e Módulos por Usuário

**Como** Gestor de uma Arena  
**Quero** definir detalhadamente quais módulos cada usuário operador pode acessar  
**Para que** cada funcionário acesse apenas as ferramentas necessárias para seu trabalho (Princípio do Menor Privilégio)  

### Critérios de Aceite:
1. **Controle de Módulos (Permissions/Modules)**: Ao cadastrar ou editar um usuário, o gestor/admin deve poder marcar/desmarcar o acesso do usuário a módulos específicos:
   - **PDV e Comandas** (Acesso às telas de vendas, consumo e caixa)
   - **CRM** (Visualização e gestão de clientes, campanhas e aniversariantes)
   - **Reservas de Quadras** (Visualização e agendamento de quadras)
   - **Filiação** (Gestão de mensalidades, planos e assinaturas de atletas)
   - **Cadastros Gerais** (Quadras, categorias, produtos - restrito para operadores sem essa permissão)
2. **Bloqueio de Rota / Middleware**: Se um usuário tentar acessar uma rota ou realizar uma Server Action de um módulo ao qual não possui acesso, o sistema deve:
   - Retornar um erro HTTP 403 (Forbidden) ou redirecionar para a tela inicial com uma mensagem de alerta.
   - Impedir a execução de funções do `core` associadas a esse módulo.
3. **Persistência de Permissões**: As permissões concedidas devem ser gravadas na tabela de usuários (`users` ou `user_permissions`) associadas ao tenant do usuário.
4. **Auditoria de Alteração de Acesso**: Toda alteração de módulos concedidos a um usuário deve registrar um log de auditoria detalhando as permissões concedidas e revogadas.

---

## US-SAAS-03: Login de Usuários com Nome de Usuário ou Email

**Como** Operador da Arena  
**Quero** realizar login utilizando meu Nome de Usuário (username) ou Email e minha senha  
**Para que** eu possa acessar o sistema mesmo sem ter um endereço de e-mail corporativo cadastrado  

### Critérios de Aceite:
1. **Flexibilidade de Login**: O campo de identificação na tela de login (`/login`) deve aceitar tanto o `username` quanto o `email` do usuário.
2. **Resolução de Tenant no Login**: O sistema de autenticação (Auth.js) deve localizar o usuário, carregar seu respectivo `tenantId`, papel (`role`) e as permissões de módulo para construir a sessão do usuário.
3. **Sessão Segura**: O token de sessão JWT gerado deve conter:
   - `userId`
   - `tenantId`
   - `role` (ex: `admin` ou `operador`)
   - `modules` (lista de slugs dos módulos permitidos)
4. **Bloqueio de Contas Desativadas**: Se um usuário estiver inativo no sistema, a autenticação deve ser recusada imediatamente com uma mensagem amigável.
