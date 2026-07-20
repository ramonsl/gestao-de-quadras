import { requireAdmin } from "@/lib/session";
import { UserForm } from "../_components/user-form";
import { createUserAction } from "../_actions/user.actions";

export default async function NovoUsuarioPage() {
  await requireAdmin();

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center bg-white border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-1)]">Novo usuário</h1>
      </header>
      <main className="flex-1 min-h-0 overflow-auto p-[22px]">
        <UserForm mode="create" action={createUserAction} />
      </main>
    </>
  );
}
