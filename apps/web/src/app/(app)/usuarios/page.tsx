import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { listArenaUsers } from "@gestao-de-quadras/core/users/user.service";
import { UserTable } from "./_components/user-table";

export default async function UsuariosPage() {
  const { ctx } = await requireAdmin();
  const users = await listArenaUsers(ctx);

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center justify-between bg-white border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-1)]">Usuários</h1>
        <Link
          href="/usuarios/novo"
          className="inline-flex items-center h-9 px-4 text-sm font-semibold text-white rounded-[var(--radius-button)] transition-colors duration-[180ms]"
          style={{ backgroundColor: "var(--accent)" }}
        >
          Novo usuário
        </Link>
      </header>

      <main className="flex-1 min-h-0 overflow-auto p-[22px]">
        <p className="mb-3 text-[11px] text-[var(--text-3)]">
          Operadores desta arena. Inativar bloqueia o login imediatamente e preserva o histórico.
        </p>
        <UserTable users={users} />
      </main>
    </>
  );
}
