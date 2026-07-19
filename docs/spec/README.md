# Especificação de Requisitos — Arena SaaS

Este diretório contém a documentação técnica oficial das User Stories (US), critérios de aceite e priorizações do Arena SaaS, estruturada sob a metodologia *Spec-Driven Development*.

## 🗺️ Índice da Especificação

*   **[global.md](file:///Users/ramonlummertz/Documents/Claude/Projects/Gerente%20de%20Tecnologia/gestao-de-quadras/docs/spec/global.md):** Requisitos Não-Funcionais (RNF), Decisões Registradas e Métricas de Sucesso do produto.
*   **[e1-saas.md](file:///Users/ramonlummertz/Documents/Claude/Projects/Gerente%20de%20Tecnologia/gestao-de-quadras/docs/spec/e1-saas.md):** Épico E1 — Plataforma SaaS e Multi-tenancy.
*   **[e2-cadastros.md](file:///Users/ramonlummertz/Documents/Claude/Projects/Gerente%20de%20Tecnologia/gestao-de-quadras/docs/spec/e2-cadastros.md):** Épico E2 — Cadastros.
*   **[e3-pdv.md](file:///Users/ramonlummertz/Documents/Claude/Projects/Gerente%20de%20Tecnologia/gestao-de-quadras/docs/spec/e3-pdv.md):** Épico E3 — PDV e Comandas.
*   **[e4-crm.md](file:///Users/ramonlummertz/Documents/Claude/Projects/Gerente%20de%20Tecnologia/gestao-de-quadras/docs/spec/e4-crm.md):** Épico E4 — CRM.
*   **[e5-filiacao.md](file:///Users/ramonlummertz/Documents/Claude/Projects/Gerente%20de%20Tecnologia/gestao-de-quadras/docs/spec/e5-filiacao.md):** Épico E5 — Filiação (Clube de Benefícios).
*   **[e6-pontos.md](file:///Users/ramonlummertz/Documents/Claude/Projects/Gerente%20de%20Tecnologia/gestao-de-quadras/docs/spec/e6-pontos.md):** Épico E6 — Pontos / Cashback.
*   **[e7-publicidade.md](file:///Users/ramonlummertz/Documents/Claude/Projects/Gerente%20de%20Tecnologia/gestao-de-quadras/docs/spec/e7-publicidade.md):** Épico E7 — Publicidade (Placas).
*   **[e8-whatsapp.md](file:///Users/ramonlummertz/Documents/Claude/Projects/Gerente%20de%20Tecnologia/gestao-de-quadras/docs/spec/e8-whatsapp.md):** Épico E8 — Notificações WhatsApp (transversal).
*   **[e9-relatorios.md](file:///Users/ramonlummertz/Documents/Claude/Projects/Gerente%20de%20Tecnologia/gestao-de-quadras/docs/spec/e9-relatorios.md):** Épico E9 — Relatórios e Dashboard.
*   **[e10-reservas.md](file:///Users/ramonlummertz/Documents/Claude/Projects/Gerente%20de%20Tecnologia/gestao-de-quadras/docs/spec/e10-reservas.md):** Épico E10 — Reservas Online de Quadras.
*   **[e11-torneios.md](file:///Users/ramonlummertz/Documents/Claude/Projects/Gerente%20de%20Tecnologia/gestao-de-quadras/docs/spec/e11-torneios.md):** Épico E11 — Torneios (versão futura).

---

## 🚦 Regras para Alteração de Requisitos

1.  **A especificação é o contrato:** Nenhuma funcionalidade é implementada no código sem uma US correspondente com critérios de aceite explícitos.
2.  **Manutenção via Spec-Keeper:** Caso seja identificada alguma divergência de regras ou novo comportamento técnico necessário, o arquivo correspondente na pasta `docs/spec/` deve ser atualizado no mesmo Commit/PR, acionando o subagente **spec-keeper**.
3.  **Não apagar histórico de decisões:** Ao alterar um critério de aceite, mantenha o histórico anotando a decisão e a data (`> Decisão (AAAA-MM-DD): ...`).
