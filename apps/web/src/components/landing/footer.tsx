import React from "react";
import Link from "next/link";
import { BrandLogo } from "./brand-logo";

export function LandingFooter() {
  return (
    <footer className="bg-[var(--sidebar-bg)] text-white pt-16 pb-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-slate-800">
          {/* Col 1: Brand & Slogan */}
          <div className="md:col-span-1 space-y-4">
            <BrandLogo variant="dark" size="lg" showTagline />
            <p className="text-xs text-slate-400 leading-relaxed pt-2">
              A solução completa para gestão de arenas esportivas e complexos de
              quadras. Grade sem conflitos, PDV de bar, clube de filiação e CRM WhatsApp.
            </p>
            <div className="pt-2">
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-md border border-slate-700 inline-block">
                RESERVOU · JOGOU · FATUROU
              </span>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">
              Plataforma
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <a href="#recursos" className="hover:text-white transition-colors">
                  Grade de Locação de Quadras
                </a>
              </li>
              <li>
                <a href="#pdv" className="hover:text-white transition-colors">
                  PDV & Comandas do Bar
                </a>
              </li>
              <li>
                <a href="#crm" className="hover:text-white transition-colors">
                  Clube de Filiação & Cashback
                </a>
              </li>
              <li>
                <a href="#demo" className="hover:text-white transition-colors">
                  WhatsApp CRM Automático
                </a>
              </li>
              <li>
                <a href="#planos" className="hover:text-white transition-colors">
                  Planos e Preços
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Portal Access */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">
              Acesso ao Sistema
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  Portal do Operador (Login)
                </Link>
              </li>
              <li>
                <Link href="/usuarios" className="hover:text-white transition-colors">
                  Painel de Controle da Arena
                </Link>
              </li>
              <li>
                <a href="#planos" className="hover:text-white transition-colors">
                  Cadastrar Nova Arena (14d grátis)
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4: Compliance & Support */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">
              Segurança & Suporte
            </h4>
            <p className="text-xs text-slate-400">
              Arquitetura de dados totalmente segura. Em conformidade com a LGPD
              para proteção e envio de notificações.
            </p>
            <div className="pt-2 text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">Suporte ao Cliente:</p>
              <p>Segunda a Sábado — 08:00 às 22:00</p>
              <p className="text-[var(--accent-bright)] font-bold">
                suporte@marcouarena.com.br
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Legal & Copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            © 2026 Marcou! Arena. Todos os direitos reservados.
          </p>

          <p className="text-[11px] text-slate-500">
            🔒 Base de dados 100% segura e isolada · Histórico seguro de vendas
          </p>
        </div>
      </div>
    </footer>
  );
}
