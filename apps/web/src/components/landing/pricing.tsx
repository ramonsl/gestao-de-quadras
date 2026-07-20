"use client";

import React, { useState } from "react";

export function LandingPricing() {
  const [annualBilling, setAnnualBilling] = useState(true);

  const plans = [
    {
      name: "Starter Arena",
      tagline: "Ideal para arenas iniciantes de 1 a 3 quadras",
      priceMonthly: 139,
      priceAnnual: 109,
      highlight: false,
      features: [
        "Até 3 quadras cadastradas",
        "Grade de Reservas visual em tempo real",
        "PDV & Comandas do bar",
        "Até 2 operadores cadastrados",
        "Relatórios de faturamento diário",
        "Dados 100% seguros e isolados",
      ],
      buttonText: "Começar Teste Grátis 14d",
      buttonVariant: "secondary",
    },
    {
      name: "Pro Arena",
      tagline: "O mais escolhido por arenas esportivas e complexos",
      priceMonthly: 269,
      priceAnnual: 219,
      highlight: true,
      popularBadge: "MAIS POPULAR",
      features: [
        "Quadras e agendamentos ilimitados",
        "Tudo do plano Starter",
        "Clube de Filiação e mensalidades",
        "Fidelidade & Cashback para atletas",
        "Lembretes e CRM automático no WhatsApp",
        "Operadores e perfis ilimitados",
        "Relatórios completos de desempenho",
        "Histórico e auditoria de vendas",
      ],
      buttonText: "Testar Pro Grátis por 14d",
      buttonVariant: "primary",
    },
    {
      name: "Multi-Arena / Enterprise",
      tagline: "Para redes de arenas e grandes complexos esportivos",
      priceMonthly: 499,
      priceAnnual: 399,
      highlight: false,
      features: [
        "Gestão de múltiplas unidades/arenas",
        "Tudo do plano Pro Arena",
        "Módulo de Torneios e Campeonatos",
        "Integrações de dados sob medida",
        "Gerente de conta dedicado",
        "Suporte prioritário",
        "Treinamento para a equipe",
      ],
      buttonText: "Falar com Consultor",
      buttonVariant: "secondary",
    },
  ];

  return (
    <section id="planos" className="py-20 bg-white border-y border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <span className="text-overline tracking-wider text-[var(--accent)] font-bold">
            PLANOS COMERCIAIS TRANSPARENTES
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-1)] tracking-tight">
            Invista no sistema que se paga com a primeira quadra cheia
          </h2>
          <p className="text-base text-[var(--text-2)]">
            Sem taxa de adesão ou fidelidade. Teste gratuitamente por 14 dias sem
            precisar de cartão de crédito.
          </p>

          {/* Billing Switcher Toggle */}
          <div className="pt-4 flex items-center justify-center gap-3">
            <span
              className={`text-sm font-semibold ${
                !annualBilling ? "text-[var(--text-1)]" : "text-[var(--text-3)]"
              }`}
            >
              Cobrança Mensal
            </span>
            <button
              type="button"
              onClick={() => setAnnualBilling(!annualBilling)}
              className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-[var(--accent)] transition-colors duration-200 ease-in-out focus:outline-hidden"
              role="switch"
              aria-checked={annualBilling}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  annualBilling ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <span
              className={`text-sm font-semibold flex items-center gap-1.5 ${
                annualBilling ? "text-[var(--text-1)]" : "text-[var(--text-3)]"
              }`}
            >
              Cobrança Anual
              <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-[var(--success-bg)] text-[var(--success)] border border-[var(--success-border)]">
                Economize 20%
              </span>
            </span>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan) => {
            const price = annualBilling ? plan.priceAnnual : plan.priceMonthly;

            return (
              <div
                key={plan.name}
                className={`relative rounded-[var(--radius-modal)] p-8 flex flex-col justify-between transition-all duration-200 ${
                  plan.highlight
                    ? "bg-white border-2 border-[var(--accent)] shadow-xl ring-4 ring-[var(--accent-tint)]"
                    : "bg-[var(--bg-app)] border border-[var(--border)] shadow-xs"
                }`}
              >
                {plan.popularBadge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[var(--accent)] text-white text-[11px] font-extrabold tracking-widest uppercase px-3 py-1 rounded-full shadow-xs">
                    {plan.popularBadge}
                  </div>
                )}

                <div>
                  <h3 className="text-xl font-bold text-[var(--text-1)] mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-[var(--text-2)] mb-6 min-h-[32px]">
                    {plan.tagline}
                  </p>

                  <div className="mb-6 pb-6 border-b border-[var(--border-soft)]">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-[var(--text-2)]">R$</span>
                      <span className="text-4xl font-extrabold text-[var(--text-1)] tracking-tight">
                        {price}
                      </span>
                      <span className="text-sm text-[var(--text-3)] font-semibold">
                        /mês
                      </span>
                    </div>
                    <p className="text-rule mt-1">
                      {annualBilling
                        ? "Faturado anualmente com 20% de desconto"
                        : "Sem contrato de fidelidade"}
                    </p>
                  </div>

                  {/* Feature Checklist */}
                  <ul className="space-y-3 text-xs text-[var(--text-2)] mb-8">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5">
                        <svg
                          className="w-4 h-4 text-[var(--success)] shrink-0 mt-0.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3 pt-4 border-t border-[var(--border-soft)]">
                  <a
                    href="#contact"
                    className={`w-full inline-flex justify-center items-center py-3 px-4 text-sm font-bold rounded-[var(--radius-button)] shadow-xs transition-colors ${
                      plan.highlight
                        ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
                        : "bg-white text-[var(--text-1)] border border-[var(--border)] hover:bg-[var(--bg-sunken)]"
                    }`}
                  >
                    {plan.buttonText}
                  </a>
                  <p className="text-rule text-center">
                    🔒 Ativação imediata sem burocracia
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Commercial Banner Microcopy */}
        <div className="mt-12 text-center">
          <div className="inline-block bg-[var(--bg-app)] px-6 py-3 rounded-[var(--radius-card)] border border-[var(--border)]">
            <p className="text-rule text-center">
              Cobrança automática recorrente com suporte a PIX e Cartão · 14 dias de teste grátis sem cartão de crédito exigido no cadastro
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
