"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type LoginActionState } from "../_actions/login.action";

const initialState: LoginActionState = { status: "idle" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; callbackUrl?: string }>;
}) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <main className="min-h-dvh flex items-center justify-center bg-[var(--bg-app)] px-4">
      <div className="w-full max-w-sm">
        {/* Marca provisória */}
        <div className="mb-8 text-center">
          <div
            className="inline-flex items-center justify-center w-10 h-10 rounded-[10px] mb-3 font-bold text-white text-lg"
            style={{ backgroundColor: "var(--accent)" }}
          >
            A
          </div>
          <p className="text-[var(--text-3)] text-sm">Acesso ao sistema da arena</p>
        </div>

        <div
          className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-6"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <h1 className="text-base font-semibold text-[var(--text-1)] mb-5">Entrar</h1>

          {state.status === "error" && (
            <div
              className="mb-4 px-3 py-2.5 rounded-[var(--radius-control)] text-sm font-medium"
              style={{
                backgroundColor: "var(--danger-bg)",
                border: "1px solid var(--danger-border)",
                color: "var(--danger)",
              }}
            >
              {state.message}
            </div>
          )}

          <form action={formAction} className="space-y-4">
            {/* tenantSlug enviado como campo hidden — resolução via query param em dev */}
            <input type="hidden" name="tenantSlug" value={process.env.NEXT_PUBLIC_TENANT_SLUG ?? ""} />

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-[var(--text-2)] mb-1.5"
              >
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="operador@arena.com.br"
                className="w-full h-9 px-3 text-sm text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-input)] outline-none transition-[border-color] duration-[180ms] placeholder:text-[var(--text-3)] focus:border-[var(--accent)]"
              />
              {state.status === "validation_error" && state.errors.email && (
                <p className="mt-1 text-rule text-[var(--danger)]">{state.errors.email[0]}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-semibold text-[var(--text-2)]">
                  Senha
                </label>
                <Link
                  href="/recuperar-senha"
                  className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors duration-[180ms]"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="w-full h-9 px-3 text-sm text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-input)] outline-none transition-[border-color] duration-[180ms] placeholder:text-[var(--text-3)] focus:border-[var(--accent)]"
              />
              {state.status === "validation_error" && state.errors.password && (
                <p className="mt-1 text-rule text-[var(--danger)]">{state.errors.password[0]}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full h-9 text-sm font-semibold text-white rounded-[var(--radius-button)] transition-[background-color] duration-[180ms] disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: pending ? "var(--text-disabled)" : "var(--accent)" }}
              onMouseEnter={(e) => {
                if (!pending) e.currentTarget.style.backgroundColor = "var(--accent-hover)";
              }}
              onMouseLeave={(e) => {
                if (!pending) e.currentTarget.style.backgroundColor = "var(--accent)";
              }}
            >
              {pending ? "Autenticando…" : "Entrar"}
            </button>
          </form>
        </div>

        <p className="text-rule text-center mt-4">
          Acesso restrito a operadores da arena.
        </p>
      </div>
    </main>
  );
}
