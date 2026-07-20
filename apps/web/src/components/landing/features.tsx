import React from "react";

export function LandingFeatures() {
  const featuresList = [
    {
      badge: "FIDELIZAÇÃO & RETENÇÃO",
      title: "Rankings do Clube & Desafios",
      description:
        "Crie rankings dinâmicos por nível e categoria. Cada partida jogada gera pontuação no clube, motivando atletas a jogarem toda semana para subir na tabela.",
      rule: "Engajamento contínuo: atletas desafiam rivais e movimentam as quadras",
      icon: (
        <svg className="w-6 h-6 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      badge: "EVENTOS & CAMPEONATOS",
      title: "Organização & Criação de Torneios",
      description:
        "Gerencie campeonatos da arena com inscrição de duplas, sorteio de chaves automáticas e tabela de classificação. Faturamento extra com inscrições e público no bar.",
      rule: "Gestão completa de torneios com chaves de grupos e eliminatórias",
      icon: (
        <svg className="w-6 h-6 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      badge: "LOCAÇÃO & GRADE",
      title: "Grade de Quadras sem Conflito",
      description:
        "Visão completa por horário e modalidade (Padel, Beach Tennis, Saibro, Society e mais). Alvos de toque amplos para tablet no balcão e sincronização instantânea.",
      rule: "Grade visual com horários flexíveis e bloqueio automático para jogos de ranking/torneio",
      icon: (
        <svg className="w-6 h-6 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      badge: "PDV & COMANDAS",
      title: "Bar & Caixa com Preços Protegidos",
      description:
        "Comandas abertas por quadra ou atleta com lançamento ultra-rápido. O sistema registra o valor no momento da venda, garantindo histórico seguro de caixa.",
      rule: "Preço histórico fixado com total segurança no caixa",
      icon: (
        <svg className="w-6 h-6 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
      ),
    },
    {
      badge: "CLUBE DE FILIAÇÃO",
      title: "Mensalidades & Filiações Recorrentes",
      description:
        "Crie planos de filiação (Ouro, Prata, Bronze) com cobrança mensal automática via PIX ou cartão de crédito. Descontos e benefícios aplicados direto no PDV.",
      rule: "Faturamento recorrente automático sem cobranças manuais",
      icon: (
        <svg className="w-6 h-6 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      badge: "AUTOMAÇÃO WHATSAPP",
      title: "Notificações & CRM no WhatsApp",
      description:
        "Envie lembretes de jogo, felicitações de aniversário com vouchers, convocação para rodadas de ranking e avisos de torneios direto no WhatsApp.",
      rule: "Mensagens automáticas para engajamento e lembretes de torneios",
      icon: (
        <svg className="w-6 h-6 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
  ];

  return (
    <section id="recursos" className="py-20 bg-[var(--bg-app)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="text-overline tracking-wider text-[var(--accent)] font-bold">
            MÓDULOS INTEGRADOS DA PLATAFORMA
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-1)] tracking-tight">
            Tudo o que sua arena precisa para faturar mais e fidelizar atletas
          </h2>
          <p className="text-base text-[var(--text-2)]">
            Vá além da simples agenda de quadras. Crie uma comunidade engajada na sua arena
            com torneios disputados, rankings de clube e benefícios recorrentes.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuresList.map((feat) => (
            <div
              key={feat.title}
              className="bg-white p-6 rounded-[var(--radius-card)] border border-[var(--border)] shadow-xs hover:border-[var(--accent)] hover:shadow-md transition-all duration-200 flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-[var(--radius-button)] bg-[var(--accent-tint)] inline-block">
                    {feat.icon}
                  </div>
                  <span className="text-overline text-[var(--accent)] bg-[var(--accent-tint-soft)] px-2 py-1 rounded-md">
                    {feat.badge}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-[var(--text-1)]">
                  {feat.title}
                </h3>

                <p className="text-sm text-[var(--text-2)] leading-relaxed">
                  {feat.description}
                </p>
              </div>

              <div className="mt-6 pt-3 border-t border-[var(--border-soft)]">
                <p className="text-rule flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                  {feat.rule}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
