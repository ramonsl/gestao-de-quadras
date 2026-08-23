import { redirect } from "next/navigation";
import { requireSession, arenaContext } from "@/lib/session";
import { getPointsSettings } from "@gestao-de-quadras/core/points";
import { PointsSettingsForm } from "./_components/points-settings-form";

/** PTS-01: página de configuração do programa de pontos / cashback (admin e gerente). */
export default async function PointsSettingsPage() {
  const session = await requireSession();
  if (!["admin", "gerente"].includes(session.role)) redirect("/negado");
  if (session.role !== "admin" && !session.modulesAllowed.includes("pontos")) {
    redirect("/negado");
  }

  const ctx = arenaContext({ id: session.userId, tenantId: session.tenantId });
  const config = await getPointsSettings(ctx);

  return (
    <main className="flex-1 p-[22px]">
      <PointsSettingsForm initialConfig={config} />
    </main>
  );
}
