import { redirect } from "next/navigation";
import { requireSession, arenaContext } from "@/lib/session";
import { getPrintConfig } from "@gestao-de-quadras/core/print";
import { PrintConfigForm } from "./_components/print-config-form";

/** CAD-07: página de configuração de impressão térmica (admin e gerente). */
export default async function PrintConfigPage() {
  const session = await requireSession();
  if (!["admin", "gerente"].includes(session.role)) redirect("/negado");

  const ctx = arenaContext({ id: session.userId, tenantId: session.tenantId });
  const config = await getPrintConfig(ctx);

  return (
    <main className="flex-1 p-[22px]">
      <PrintConfigForm initialConfig={config} />
    </main>
  );
}
