"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { ArenaUserListItem } from "@gestao-de-quadras/core/users/user.service";
import { ROLE_LABELS } from "@/lib/labels";
import {
  deactivateUserAction,
  reactivateUserAction,
  resetPasswordAction,
} from "../_actions/user.actions";

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function StatusPill({ status }: { status: ArenaUserListItem["status"] }) {
  const active = status === "active";
  return (
    <span
      className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-[var(--radius-pill)] text-[11px] font-semibold"
      style={{
        backgroundColor: active ? "var(--accent-tint)" : "var(--border-soft)",
        color: active ? "var(--accent-hover)" : "var(--text-3)",
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: active ? "var(--success)" : "var(--text-3)" }}
      />
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

export function UserTable({ users }: { users: ArenaUserListItem[] }) {
  const [error, setError] = useState<string | null>(null);

  if (users.length === 0) {
    return (
      <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-8 text-center text-sm text-[var(--text-3)]">
        Nenhum usuário cadastrado ainda.
      </div>
    );
  }

  return (
    <>
      {error && (
        <div
          className="mb-3 px-3 py-2.5 rounded-[var(--radius-control)] text-sm"
          style={{
            backgroundColor: "var(--danger-bg)",
            border: "1px solid var(--danger-border)",
            color: "var(--danger)",
          }}
        >
          {error}
        </div>
      )}
      <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-overline text-[var(--text-3)] border-b border-[var(--border)]">
              <th className="px-4 py-3">NOME · USUÁRIO</th>
              <th className="px-4 py-3">PERFIL</th>
              <th className="px-4 py-3">MÓDULOS</th>
              <th className="px-4 py-3">STATUS</th>
              <th className="px-4 py-3">ÚLTIMO ACESSO</th>
              <th className="px-4 py-3 text-right">AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <UserRow key={user.id} user={user} onError={setError} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function UserRow({
  user,
  onError,
}: {
  user: ArenaUserListItem;
  onError: (message: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [forceChange, setForceChange] = useState(true);

  function toggleStatus() {
    onError(null);
    startTransition(async () => {
      const result =
        user.status === "active"
          ? await deactivateUserAction(user.id)
          : await reactivateUserAction(user.id);
      if (result.status === "error") onError(result.message);
    });
  }

  function submitReset() {
    onError(null);
    startTransition(async () => {
      const result = await resetPasswordAction(user.id, newPassword, forceChange);
      if (result.status === "error") {
        onError(result.message);
      } else {
        setResetting(false);
        setNewPassword("");
      }
    });
  }

  return (
    <>
      <tr className="border-b border-[var(--border-soft)] last:border-0">
        <td className="px-4 py-3">
          <div className="font-medium text-[var(--text-1)]">{user.name}</div>
          <div className="text-[var(--text-3)]">
            {user.username}
            {user.email ? ` · ${user.email}` : ""}
          </div>
        </td>
        <td className="px-4 py-3 text-[var(--text-2)]">{ROLE_LABELS[user.role]}</td>
        <td className="px-4 py-3 text-[var(--text-2)]">
          {user.role === "admin" ? "Todos" : `${user.modulesAllowed.length} módulo(s)`}
        </td>
        <td className="px-4 py-3">
          <StatusPill status={user.status} />
        </td>
        <td className="px-4 py-3 text-[var(--text-2)]">{formatDate(user.lastLoginAt)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-3">
            <Link
              href={`/usuarios/${user.id}/editar`}
              className="text-[var(--accent)] hover:text-[var(--accent-hover)]"
            >
              Editar
            </Link>
            <button
              type="button"
              onClick={() => setResetting((v) => !v)}
              className="text-[var(--text-2)] hover:text-[var(--text-1)]"
            >
              Redefinir senha
            </button>
            <button
              type="button"
              onClick={toggleStatus}
              disabled={pending}
              className="disabled:opacity-50"
              style={{ color: user.status === "active" ? "var(--danger)" : "var(--success)" }}
            >
              {user.status === "active" ? "Inativar" : "Reativar"}
            </button>
          </div>
        </td>
      </tr>
      {resetting && (
        <tr className="bg-[var(--bg-sunken)] border-b border-[var(--border-soft)]">
          <td colSpan={6} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nova senha (mín. 8 caracteres)"
                className="h-9 px-3 text-sm bg-white border border-[var(--border)] rounded-[var(--radius-input)] outline-none focus:border-[var(--accent)]"
              />
              <label className="flex items-center gap-2 text-[12.5px] text-[var(--text-2)]">
                <input
                  type="checkbox"
                  checked={forceChange}
                  onChange={(e) => setForceChange(e.target.checked)}
                />
                Exigir troca no próximo login
              </label>
              <button
                type="button"
                onClick={submitReset}
                disabled={pending || newPassword.length < 8}
                className="h-9 px-4 text-sm font-semibold text-white rounded-[var(--radius-button)] disabled:opacity-50"
                style={{ backgroundColor: "var(--accent)" }}
              >
                {pending ? "Salvando…" : "Salvar senha"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setResetting(false);
                  setNewPassword("");
                }}
                className="text-sm text-[var(--text-3)]"
              >
                Cancelar
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
