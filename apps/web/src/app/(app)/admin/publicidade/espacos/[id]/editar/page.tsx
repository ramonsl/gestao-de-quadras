import { redirect } from "next/navigation";
import { requireSession, arenaContext } from "@/lib/session";
import { getAdSpaceById } from "@gestao-de-quadras/core/publicidade/ad-space.service";
import { AdSpaceForm } from "../../_components/ad-space-form";
import { updateAdSpaceAction, deleteAdSpaceAction } from "../../_actions/ad-space.actions";
import { Button } from "@/components/ui/button";

export default async function EditarEspacoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  if (!["admin", "gerente"].includes(session.role)) redirect("/negado");
  const ctx = arenaContext({ id: session.userId, tenantId: session.tenantId });

  const space = await getAdSpaceById(id, ctx);
  if (!space) redirect("/admin/publicidade/espacos");

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center justify-between bg-white border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-1)]">Editar espaço publicitário</h1>
        <form
          action={async () => {
            "use server";
            await deleteAdSpaceAction(space.id);
            redirect("/admin/publicidade/espacos");
          }}
        >
          <Button type="submit" variant="destructive" size="sm">Excluir</Button>
        </form>
      </header>
      <main className="flex-1 min-h-0 overflow-auto p-[22px]">
        <AdSpaceForm
          action={(prev, formData) => updateAdSpaceAction(space.id, prev, formData)}
          initialData={space}
        />
      </main>
    </>
  );
}
