import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { requireSession, arenaContext } from "@/lib/session";
import { getCustomerProfile360 } from "@gestao-de-quadras/core/customers/customer-profile.service";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProfileHeader } from "./_components/profile-header";
import { IndicatorCards } from "./_components/indicator-cards";
import { QuickActionBar } from "./_components/quick-action-bar";
import { ProfileTabs } from "./_components/profile-tabs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Um id malformado bateria no cast uuid do Postgres (erro 500) em vez de
  // seguir o caminho previsto — redireciona antes de tocar o banco.
  if (!UUID_PATTERN.test(id)) {
    redirect("/customers");
  }

  const session = await requireSession();
  const ctx = arenaContext({ id: session.userId, tenantId: session.tenantId });
  const profile = await getCustomerProfile360(ctx, id);

  if (!profile) {
    redirect("/customers");
  }

  return (
    <>
      <header className="h-14 shrink-0 px-[22px] flex items-center gap-3 bg-white border-b border-[var(--border)]">
        <Link
          href="/customers"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-2)] hover:text-[var(--text-1)]"
        >
          <ArrowLeft className="size-4" /> Clientes
        </Link>
        <span className="text-[var(--text-3)]">/</span>
        <span className="text-[13px] font-semibold text-[var(--text-1)] truncate">
          {profile.customer.name}
        </span>
      </header>

      <main className="flex-1 min-h-0 overflow-auto p-[22px] space-y-4">
        <ProfileHeader profile={profile} />

        {profile.debit.isBlocked && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Novas comandas e reservas bloqueadas</AlertTitle>
            <AlertDescription>
              O saldo devedor deste cliente atingiu o limite da arena. Quite o saldo pendente para
              liberar novos lançamentos.
            </AlertDescription>
          </Alert>
        )}

        <IndicatorCards profile={profile} />

        <QuickActionBar />

        <ProfileTabs
          comandas={profile.comandas}
          classBalances={profile.classBalances}
          debit={profile.debit}
        />
      </main>
    </>
  );
}
