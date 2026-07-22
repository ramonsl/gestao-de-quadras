import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { AdSpaceForm } from "../_components/ad-space-form";
import { createAdSpaceAction } from "../_actions/ad-space.actions";

export default async function NovoEspacoPage() {
  const session = await requireSession();
  if (!["admin", "gerente"].includes(session.role)) redirect("/negado");

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center bg-white border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-1)]">Novo espaço publicitário</h1>
      </header>
      <main className="flex-1 min-h-0 overflow-auto p-[22px]">
        <AdSpaceForm action={createAdSpaceAction} />
      </main>
    </>
  );
}
