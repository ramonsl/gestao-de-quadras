"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { activateAccountAction, type ActivateAccountActionState } from "../../_actions/activate-account.action";

const initialState: ActivateAccountActionState = { status: "idle" };

export default function AtivarContaPage() {
  const params = useParams<{ token: string }>();
  const [state, formAction, pending] = useActionState(activateAccountAction, initialState);

  if (state.status === "success") {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-[var(--bg-app)] px-4">
        <div className="w-full max-w-sm">
          <div
            className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-6 text-center"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <h1 className="text-base font-semibold text-[var(--text-1)] mb-2">Conta ativada</h1>
            <p className="text-sm text-[var(--text-2)] mb-4">
              Sua senha foi definida e o acesso está liberado.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center h-9 px-4 text-sm font-semibold text-white rounded-[var(--radius-button)] transition-[background-color] duration-[180ms]"
              style={{ backgroundColor: "var(--accent)" }}
            >
              Entrar no sistema
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
          <p className="text-sm text-[var(--text-2)]">Primeiro acesso</p>
        </div>

        <div
          className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-6"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <h1 className="text-base font-semibold text-[var(--text-1)] mb-1">Definir senha</h1>
          <p className="text-sm text-[var(--text-2)] mb-5">
            Crie sua senha para ativar o acesso ao sistema.
          </p>

          {state.status === "error" && (
            <div
              className="mb-4 px-3 py-2.5 rounded-[var(--radius-control)] text-sm"
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
            <input type="hidden" name="token" value={params.token} />

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-[var(--text-2)] mb-1.5">
                Nova senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="Mínimo 8 caracteres"
                className="w-full h-9 px-3 text-sm text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-input)] outline-none transition-[border-color] duration-[180ms] placeholder:text-[var(--text-3)] focus:border-[var(--accent)]"
              />
              {state.status === "validation_error" && state.errors.password && (
                <p className="mt-1 text-rule text-[var(--danger)]">{state.errors.password[0]}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-semibold text-[var(--text-2)] mb-1.5">
                Confirmar senha
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Repita a senha"
                className="w-full h-9 px-3 text-sm text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-input)] outline-none transition-[border-color] duration-[180ms] placeholder:text-[var(--text-3)] focus:border-[var(--accent)]"
              />
              {state.status === "validation_error" && state.errors.confirmPassword && (
                <p className="mt-1 text-rule text-[var(--danger)]">{state.errors.confirmPassword[0]}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full h-9 text-sm font-semibold text-white rounded-[var(--radius-button)] transition-[background-color] duration-[180ms] disabled:opacity-60"
              style={{ backgroundColor: "var(--accent)" }}
            >
              {pending ? "Ativando…" : "Ativar conta"}
            </button>
          </form>
        </div>

        <p className="text-rule text-center mt-4">
          Link de ativação válido por 48 horas após o envio do convite.
        </p>
      </div>
    </main>
  );
}
