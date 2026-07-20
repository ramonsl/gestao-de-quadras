"use client";

import React, { useState } from "react";

interface FAQItem {
  question: string;
  answer: string;
}

export function LandingFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqItems: FAQItem[] = [
    {
      question: "Preciso instalar algum programa ou comprar computador especial?",
      answer:
        "Não! O Marcou Arena é 100% em nuvem e funciona em qualquer computador, tablet (iPad/Android) ou celular com navegador moderno. Você pode operar o caixa no balcão e conferir relatórios de onde estiver.",
    },
    {
      question: "Como funciona a integração com o WhatsApp para lembretes?",
      answer:
        "O sistema possui automação para envio de mensagens. Ele dispara automaticamente lembretes 2h antes do jogo, mensagens de parabéns com voucher no aniversário e convites de reativação para atletas que não jogam há mais de 15 dias.",
    },
    {
      question: "Os dados da minha arena estão seguros e isolados de outros concorrentes?",
      answer:
        "Absolutamente. Cada arena possui sua base de dados 100% privada e isolada. Dados de clientes, comandas, faturamento e saldo de pontos da sua arena são totalmente seguros.",
    },
    {
      question: "O que acontece se eu mudar os preços do bar? Afeta comandas abertas?",
      answer:
        "Não afeta. O Marcou Arena grava o preço exato do item no momento em que ele é lançado na comanda. Assim, o valor histórico da venda permanece protegido mesmo se o preço no cardápio for alterado no futuro.",
    },
    {
      question: "Como funciona a cobrança das mensalidades do Clube de Filiação?",
      answer:
        "Você configura os planos (ex: Ouro, Prata, Bronze) e o sistema gera as cobranças recorrentes de forma automática via PIX ou cartão de crédito. Os filiados ganham descontos automáticos no balcão.",
    },
    {
      question: "Posso testar gratuitamente antes de contratar?",
      answer:
        "Sim! Oferecemos 14 dias de teste grátis com acesso irrestrito a todos os recursos. Não exigimos cartão de crédito para cadastrar e você pode cancelar quando quiser.",
    },
  ];

  return (
    <section id="faq" className="py-20 bg-[var(--bg-app)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 space-y-3">
          <span className="text-overline tracking-wider text-[var(--accent)] font-bold">
            TIRA-DÚVIDAS OPERACIONAL
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-1)] tracking-tight">
            Perguntas Frequentes
          </h2>
          <p className="text-base text-[var(--text-2)]">
            Tudo o que você precisa saber sobre a implantação e segurança do Marcou Arena.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-4">
          {faqItems.map((item, index) => {
            const isOpen = openIndex === index;

            return (
              <div
                key={item.question}
                className="bg-white rounded-[var(--radius-card)] border border-[var(--border)] shadow-2xs overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-base text-[var(--text-1)] hover:text-[var(--accent)] focus:outline-hidden"
                  aria-expanded={isOpen}
                >
                  <span>{item.question}</span>
                  <svg
                    className={`w-5 h-5 text-[var(--accent)] shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-sm text-[var(--text-2)] leading-relaxed border-t border-[var(--border-soft)] animate-in fade-in duration-150">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
