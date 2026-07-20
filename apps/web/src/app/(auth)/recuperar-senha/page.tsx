"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction, type ForgotPasswordActionState } from "../_actions/forgot-password.action";

const initialState: ForgotPasswordActionState = { status: "idle" };

export default function RecuperarSenhaPage() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initialState);

  if (state.status === "sent") {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-[var(--bg-app)] px-4">
        <div className="w-full max-w-sm">
          <div
            className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-6 text-center"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <h1 className="text-base font-semibold text-[var(--text-1)] mb-2">E-mail enviado</h1>
            <p className="text-sm text-[var(--text-2)] mb-4">
              Se o e-mail informado estiver cadastrado, você receberá as instruções em breve.
              Verifique sua caixa de entrada e a pasta de spam.
            </p>
            <Link
              href="/login"
              className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors duration-[180ms]"
            >
              Voltar ao login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex items-center justify-center bg-[var(--bg-app)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div
            className="inline-flex items-center justify-center w-10 h-10 rounded-[10px] mb-3 font-bold text-white text-lg"
            style={{ backgroundColor: "var(--accent)" }}
          >
            A
          </div>
        </div>

        <div
          className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-6"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <h1 className="text-base font-semibold text-[var(--text-1)] mb-1">Recuperar senha</h1>
          <p className="text-sm text-[var(--text-2)] mb-5">
            Informe o e-mail cadastrado. Enviaremos um link de redefinição.
          </p>

          <form action={formAction} className="space-y-4">

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-[var(--text-2)] mb-1.5">
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

            <button
              type="submit"
              disabled={pending}
              className="w-full h-9 text-sm font-semibold text-white rounded-[var(--radius-button)] transition-[background-color] duration-[180ms] disabled:opacity-60"
              style={{ backgroundColor: "var(--accent)" }}
            >
              {pending ? "Enviando…" : "Enviar instruções"}
            </button>

            <div className="text-center">
              <Link
                href="/login"
                className="text-xs text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors duration-[180ms]"
              >
                Voltar ao login
              </Link>
            </div>
          </form>
        </div>

        <p className="text-rule text-center mt-4">
          Link válido por 24 horas após o envio.
        </p>
      </div>
    </main>
  );
}
