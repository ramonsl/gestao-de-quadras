import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { getArenaUser } from "@gestao-de-quadras/core/users/user.service";
import { UserForm } from "../../_components/user-form";
import { updateUserAction } from "../../_actions/user.actions";

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const { ctx } = await requireAdmin();
  const user = await getArenaUser(ctx, userId);
  if (!user) notFound();

  const action = updateUserAction.bind(null, userId);

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center bg-white border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-1)]">Editar usuário</h1>
      </header>
      <main className="flex-1 min-h-0 overflow-auto p-[22px]">
        <UserForm mode="edit" action={action} user={user} />
      </main>
    </>
  );
}
