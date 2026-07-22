import { redirect } from "next/navigation";
import { requireSession, arenaContext } from "@/lib/session";
import { getAdvertiserById } from "@gestao-de-quadras/core/publicidade/advertiser.service";
import { AdvertiserForm } from "../../_components/advertiser-form";
import { updateAdvertiserAction, deleteAdvertiserAction } from "../../_actions/advertiser.actions";
import { Button } from "@/components/ui/button";

export default async function EditarAnunciantePage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!["admin", "gerente"].includes(session.role)) redirect("/negado");
  const ctx = arenaContext({ id: session.userId, tenantId: session.tenantId });

  const advertiser = await getAdvertiserById(params.id, ctx);
  if (!advertiser) redirect("/admin/publicidade/anunciantes");

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center justify-between bg-white border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-1)]">Editar anunciante</h1>
        <form
          action={async () => {
            "use server";
            await deleteAdvertiserAction(advertiser.id);
            redirect("/admin/publicidade/anunciantes");
          }}
        >
          <Button type="submit" variant="destructive" size="sm">Excluir</Button>
        </form>
      </header>
      <main className="flex-1 min-h-0 overflow-auto p-[22px]">
        <AdvertiserForm
          action={(prev, formData) => updateAdvertiserAction(advertiser.id, prev, formData)}
          initialData={advertiser}
        />
      </main>
    </>
  );
}
