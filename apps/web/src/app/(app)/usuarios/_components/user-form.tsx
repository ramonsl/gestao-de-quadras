"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { MODULES, MODULE_LABELS } from "@gestao-de-quadras/core/users/modules";
import type { ArenaUserListItem } from "@gestao-de-quadras/core/users/user.service";
import type { UserFormState } from "../_actions/user.actions";

const initialState: UserFormState = { status: "idle" };

const ROLES: { value: ArenaUserListItem["role"]; label: string }[] = [
  { value: "atendente", label: "Atendente" },
  { value: "gerente", label: "Gerente" },
  { value: "admin", label: "Admin" },
];

const labelCls = "block text-xs font-semibold text-[var(--text-2)] mb-1.5";
const inputCls =
  "w-full h-9 px-3 text-sm text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-input)] outline-none transition-[border-color] duration-[180ms] placeholder:text-[var(--text-3)] focus:border-[var(--accent)]";

export function UserForm({
  mode,
  action,
  user,
}: {
  mode: "create" | "edit";
  action: (prev: UserFormState, formData: FormData) => Promise<UserFormState>;
  user?: ArenaUserListItem;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "success") router.push("/usuarios");
  }, [state.status, router]);

  const errors = state.status === "validation_error" ? state.errors : {};

  return (
    <form
      action={formAction}
      className="max-w-2xl bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-6 space-y-5"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {state.status === "error" && (
        <div
          className="px-3 py-2.5 rounded-[var(--radius-control)] text-sm"
          style={{
            backgroundColor: "var(--danger-bg)",
            border: "1px solid var(--danger-border)",
            color: "var(--danger)",
          }}
        >
          {state.message}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className={labelCls}>Nome completo</label>
          <input id="name" name="name" type="text" required defaultValue={user?.name} className={inputCls} />
          {errors.name && <p className="mt-1 text-[11px] text-[var(--danger)]">{errors.name[0]}</p>}
        </div>

        {mode === "create" ? (
          <div>
            <label htmlFor="username" className={labelCls}>Usuário (login)</label>
            <input id="username" name="username" type="text" required autoComplete="off" placeholder="ex.: caixa01" className={inputCls} />
            {errors.username && <p className="mt-1 text-[11px] text-[var(--danger)]">{errors.username[0]}</p>}
          </div>
        ) : (
          <div>
            <label className={labelCls}>Usuário (login)</label>
            <input type="text" value={user?.username} disabled className={`${inputCls} bg-[var(--bg-sunken)] text-[var(--text-3)]`} />
            <p className="mt-1 text-[11px] text-[var(--text-3)]">O login não pode ser alterado.</p>
          </div>
        )}

        <div>
          <label htmlFor="email" className={labelCls}>E-mail (opcional)</label>
          <input id="email" name="email" type="email" defaultValue={user?.email ?? ""} placeholder="opcional" className={inputCls} />
          {errors.email && <p className="mt-1 text-[11px] text-[var(--danger)]">{errors.email[0]}</p>}
        </div>

        <div>
          <label htmlFor="phone" className={labelCls}>Telefone (opcional)</label>
          <input id="phone" name="phone" type="tel" defaultValue={user?.phone ?? ""} placeholder="opcional" className={inputCls} />
        </div>

        {mode === "create" && (
          <div>
            <label htmlFor="password" className={labelCls}>Senha inicial</label>
            <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="Mínimo 8 caracteres" className={inputCls} />
            {errors.password && <p className="mt-1 text-[11px] text-[var(--danger)]">{errors.password[0]}</p>}
          </div>
        )}

        <div>
          <label htmlFor="role" className={labelCls}>Perfil</label>
          <select id="role" name="role" defaultValue={user?.role ?? "atendente"} className={inputCls}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Módulos liberados</label>
        <p className="mb-2 text-[11px] text-[var(--text-3)]">
          Admin tem acesso irrestrito; a seleção abaixo vale para Gerente e Atendente.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {MODULES.map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm text-[var(--text-2)]">
              <input
                type="checkbox"
                name={`module_${m}`}
                defaultChecked={user?.modulesAllowed.includes(m)}
              />
              {MODULE_LABELS[m]}
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--text-2)]">
        <input type="checkbox" name="mustChangePassword" defaultChecked={user?.mustChangePassword} />
        Exigir troca de senha no primeiro acesso
      </label>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="h-9 px-4 text-sm font-semibold text-white rounded-[var(--radius-button)] transition-colors duration-[180ms] disabled:opacity-60"
          style={{ backgroundColor: "var(--accent)" }}
        >
          {pending ? "Salvando…" : mode === "create" ? "Criar usuário" : "Salvar alterações"}
        </button>
        <Link href="/usuarios" className="text-sm text-[var(--text-3)] hover:text-[var(--text-2)]">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
