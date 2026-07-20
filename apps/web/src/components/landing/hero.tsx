import React from "react";
import Link from "next/link";
import { BrandLogo } from "./brand-logo";

export function LandingHero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-linear-to-b from-[var(--bg-app)] via-[var(--bg-sunken)] to-[var(--bg-app)]">
      {/* Background Accent Decorative Elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[var(--accent-tint)] rounded-full blur-3xl opacity-60 pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto space-y-6">
          {/* Overline & Brand Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[var(--radius-pill)] bg-[var(--accent-tint)] border border-[var(--border-soft)]">
            <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
            <span className="text-overline tracking-wider text-[var(--accent)] font-bold">
              SISTEMA COMPLETO DE GESTÃO PARA ARENAS ESPORTIVAS
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-[var(--text-1)] tracking-tight leading-tight">
            Gerencie quadras, bar, filiação e caixa da sua arena com{" "}
            <span className="text-[var(--accent)] underline decoration-[var(--accent-bright)] decoration-wavy decoration-2">
              faturamento máximo
            </span>
            .
          </h1>

          {/* Brand Tagline Banner */}
          <div className="pt-2 pb-1">
            <p className="text-xs sm:text-sm tracking-[0.25em] font-extrabold uppercase text-[var(--accent)] bg-white inline-block px-4 py-2 rounded-lg border border-[var(--border)] shadow-xs">
              RESERVOU · JOGOU · FATUROU
            </p>
          </div>

          {/* Subheadline */}
          <p className="text-base sm:text-xl text-[var(--text-2)] max-w-3xl mx-auto leading-relaxed">
            O software ideal para Arenas Esportivas e Complexos de Quadras (Padel,
            Beach Tennis, Saibro, Society, Pickleball e mais). Grade de reservas
            sem conflito, comandas de PDV com controle financeiro, clube de benefícios
            e atendimento automatizado no WhatsApp.
          </p>

          {/* Microcopy Signature Rule */}
          <div className="inline-block bg-white/80 backdrop-blur-xs px-4 py-2 rounded-[var(--radius-card)] border border-[var(--border)]">
            <p className="text-rule text-center">
              🔒 Dados 100% seguros e isolados · ⚡ Lançamentos rápidos no caixa · 💬 Lembretes automáticos no WhatsApp
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#planos"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-[var(--radius-button)] shadow-md hover:shadow-lg transition-all duration-200"
            >
              Testar 14 Dias Grátis
              <svg
                className="w-5 h-5 ml-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </a>

            <a
              href="#demo"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-bold text-[var(--text-1)] bg-white border border-[var(--border)] hover:bg-[var(--bg-sunken)] rounded-[var(--radius-button)] shadow-xs transition-colors"
            >
              <svg
                className="w-5 h-5 mr-2 text-[var(--accent)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Ver Grade em Tempo Real
            </a>
          </div>

          {/* Social Proof Metric Counters */}
          <div className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
            <div className="bg-white p-4 rounded-[var(--radius-card)] border border-[var(--border)] shadow-xs">
              <span className="text-kpi text-[var(--accent)] block">+120</span>
              <span className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">
                Arenas Ativas
              </span>
              <p className="text-rule mt-1">Multi-modalidades esportivas</p>
            </div>

            <div className="bg-white p-4 rounded-[var(--radius-card)] border border-[var(--border)] shadow-xs">
              <span className="text-kpi text-[var(--text-1)] block">99.8%</span>
              <span className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">
                Taxa de Ocupação
              </span>
              <p className="text-rule mt-1">Em horários nobres das 18h às 23h</p>
            </div>

            <div className="bg-white p-4 rounded-[var(--radius-card)] border border-[var(--border)] shadow-xs">
              <span className="text-kpi text-[var(--accent)] block">3.2x</span>
              <span className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">
                Vendas no Bar/PDV
              </span>
              <p className="text-rule mt-1">Comandas abertas direto na quadra</p>
            </div>

            <div className="bg-white p-4 rounded-[var(--radius-card)] border border-[var(--border)] shadow-xs">
              <span className="text-kpi text-[var(--text-1)] block">0</span>
              <span className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wide">
                Conflitos de Reserva
              </span>
              <p className="text-rule mt-1">Sincronização instantânea</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
