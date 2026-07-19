# Especificações Globais — Arena SaaS

Este documento reúne os requisitos não-funcionais transversais, decisões arquiteturais consolidadas e métricas de sucesso que regem todo o ecossistema do Arena SaaS.

---

## 1. Requisitos Não Funcionais (RNF)

*   **RNF-01 (Multi-tenancy):** Isolamento estrito de dados por schema dedicado no PostgreSQL por arena (tenant). Nenhuma query ou API pode expor ou vazar dados entre arenas diferentes. Backups e restaurações devem ser possíveis de forma individual por schema de tenant.
*   **RNF-02 (Desempenho):** Operações críticas do PDV (busca de cliente, lançamento de item, fechamento de comanda) devem responder em um tempo limite de até 2 segundos.
*   **RNF-03 (Disponibilidade):** O sistema deve possuir disponibilidade de 99,5% mensal, com rotina de backups diários automáticos com restauração validada.
*   **RNF-04 (Segurança e LGPD):**
    *   Toda a comunicação em trânsito deve ser criptografada (HTTPS) e dados sensíveis em repouso devem ser protegidos.
    *   Consentimento explícito registrado para comunicações de WhatsApp/E-mail (opt-in com timestamp).
    *   Mecanismo de exclusão de dados pessoais a pedido do cliente final (direito de ser esquecido).
*   **RNF-05 (Usabilidade):** Interface web responsiva adaptável a desktop, tablets e smartphones. O PDV deve ser otimizado para operação por toque (touch screen) em tablets, permitindo operação ágil e com o mínimo de toques possível, sem necessidade de treinamento formal prévio.
*   **RNF-06 (Resiliência Offline do PDV - P2):** Avaliar mecanismos de operação degradada/offline temporária com fila local para sincronização posterior em caso de instabilidade na conexão de internet.
*   **RNF-07 (Escalabilidade):** Arquitetura desenhada para suportar dezenas de tenants ativos concorrentemente sem necessidade de retrabalho ou reestruturação de banco de dados.

---

## 2. Decisões Registradas

| Tema | Decisão Consolidada |
| :--- | :--- |
| **Multi-tenancy** | Um schema dedicado no banco de dados por arena (tenant) — balanceando isolamento físico/lógico, custo e facilidade de backup. |
| **Comanda não paga** | Em vez de bloquear o fluxo físico de saída, a comanda não paga é transferida para a conta do cliente (gerando saldo devedor pendente). O PDV alertará sobre o saldo devedor na próxima abertura de comanda (PDV-11). |
| **Limites de Devedor** | O saldo devedor é **configurável por arena**. O administrador poderá definir se o cliente tem limite de valor de saldo devedor acumulado e se novas comandas devem ser bloqueadas automaticamente quando o limite for ultrapassado. |
| **Reserva de Quadras** | As reservas de quadras serão feitas online de forma direta. A agenda fica aberta de forma igualitária para todos os clientes identificados na página pública (RES-01). |
| **Fidelização (Pontos)** | O programa de cashback/pontos é totalmente parametrizável por arena, incluindo a possibilidade de desativação total, resgates parciais e restrição de resgate exclusivo a clientes filiados (PTS-01). |
| **Gateway de Pagamento** | Integração direta com a API do gateway **Asaas** para faturamento recorrente de planos de filiação e assinaturas do SaaS (Pix e Cartão de Crédito). |
| **WhatsApp** | Conexão local de WhatsApp via **Baileys** no v1 (escanear QR Code do número próprio de cada arena). Arquitetura de mensageria com fila persistente (BullMQ + Redis) para isolar a dependência do Baileys. |
| **Hospedagem Baileys** | Para manter o menor custo de RAM e processamento, as conexões Baileys de cada arena serão gerenciadas dinamicamente dentro de um pool assíncrono centralizado no mesmo processo do Worker, compartilhando o runtime Node.js, em vez de criar um processo/contêiner separado por tenant. |
| **Perfil Professor** | Empurrado para a versão v2 (P2). No v1, a alocação de horários de aulas e controle de presença/pacotes será gerenciada centralmente pelo caixa ou administrador. |
| **Perfis de Acesso** | Substituição dos papéis `Administrador / Caixa / Marketing` pelos perfis `Admin / Gerente / Atendente` (decisão de 2026-07-19). Matriz de módulos visíveis por perfil é configurável por arena pelo Admin (SAAS-02, SAAS-10). |
| **Identidade Global de Clientes** | O WhatsApp é o identificador universal do cliente. Dados pessoais globais (nome, e-mail, nascimento) são armazenados no schema `public` (`global_customers`) e reaproveitados entre arenas. Pontos, comandas, filiação e histórico de consumo são **sempre isolados** no schema do tenant local. Opt-in LGPD é registrado por arena individualmente (CAD-01). |
| **Backoffice Core** | Login dedicado e separado para o painel de operação do SaaS, com perfis Super Admin (MFA obrigatório) e Suporte (somente-leitura). Credenciais armazenadas no schema `public`, nunca nos schemas de tenant (SAAS-11). |

---

## 3. Métricas de Sucesso (Pós-Implantação)

*   **Adoção:** 100% das vendas da arena piloto registradas e processadas pelo PDV em até 30 dias após o go-live da Fase 2.
*   **Transparência:** Taxa de sucesso de entrega das notificações de lançamento de comanda via WhatsApp $\ge 80\%$.
*   **Recorrência:** Taxa de churn mensal de filiados inferior a 5% após 3 meses de operação da Fase 3.
*   **Fidelização:** Mais de 30% dos filiados ativos realizando pelo menos um resgate de pontos no primeiro trimestre após o go-live da Fase 4.
*   **Reativação:** Taxa de retorno de clientes inativos que receberam campanha de reativação pelo CRM superior a 15%.
