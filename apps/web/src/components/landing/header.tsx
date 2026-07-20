"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { BrandLogo } from "./brand-logo";

interface LandingHeaderProps {
  isLoggedIn?: boolean;
}

export function LandingHeader({ isLoggedIn = false }: LandingHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Recursos", href: "#recursos" },
    { label: "Grade Interativa", href: "#demo" },
    { label: "PDV & Comandas", href: "#demo" },
    { label: "Fidelidade & CRM", href: "#demo" },
    { label: "Planos", href: "#planos" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled
          ? "bg-white/95 backdrop-blur-md shadow-xs border-b border-[var(--border)] py-3"
          : "bg-[var(--bg-app)] py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Brand Logo */}
          <Link
            href="/"
            aria-label="Marcou Arena Home"
            className="flex items-center gap-2 group focus:outline-hidden"
          >
            <BrandLogo size="md" />
          </Link>

          {/* Desktop Navigation Links */}
          <nav
            className="hidden md:flex items-center gap-6"
            aria-label="Navegação Principal"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-[var(--text-2)] hover:text-[var(--accent)] transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-3">
            {isLoggedIn ? (
              <Link
                href="/usuarios"
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-[var(--radius-button)] shadow-xs transition-colors"
              >
                Ir para o Painel →
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-[var(--text-1)] bg-white border border-[var(--border)] hover:bg-[var(--bg-sunken)] rounded-[var(--radius-button)] transition-colors"
                >
                  Entrar
                </Link>
                <a
                  href="#planos"
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-[var(--radius-button)] shadow-xs transition-colors"
                >
                  Testar Grátis 14d
                </a>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[var(--text-2)] hover:text-[var(--text-1)] rounded-md focus:outline-hidden"
              aria-expanded={mobileMenuOpen}
              aria-label="Menu Principal"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-[var(--border)] px-4 pt-2 pb-6 space-y-3 mt-3 shadow-md animate-in slide-in-from-top-2">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-medium text-[var(--text-1)] hover:text-[var(--accent)] border-b border-[var(--border-soft)]"
            >
              {link.label}
            </a>
          ))}
          <div className="pt-2 flex flex-col gap-2">
            {isLoggedIn ? (
              <Link
                href="/usuarios"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 text-sm font-semibold text-white bg-[var(--accent)] rounded-[var(--radius-button)]"
              >
                Ir para o Painel
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 text-sm font-semibold text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-button)]"
                >
                  Entrar no Sistema
                </Link>
                <a
                  href="#planos"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 text-sm font-semibold text-white bg-[var(--accent)] rounded-[var(--radius-button)]"
                >
                  Testar 14 Dias Grátis
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
