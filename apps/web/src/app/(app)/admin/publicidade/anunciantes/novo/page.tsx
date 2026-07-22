import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { AdvertiserForm } from "../_components/advertiser-form";
import { createAdvertiserAction } from "../_actions/advertiser.actions";

export default async function NovoAnunciantePage() {
  const session = await requireSession();
  if (!["admin", "gerente"].includes(session.role)) redirect("/negado");

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center bg-white border-b border-[var(--border)]">
        <h1 className="text-base font-semibold text-[var(--text-1)]">Novo anunciante</h1>
      </header>
      <main className="flex-1 min-h-0 overflow-auto p-[22px]">
        <AdvertiserForm action={createAdvertiserAction} />
      </main>
    </>
  );
}
