import { requireModule } from "@/lib/session";
import {
  getCurrentOpenCashSession,
  getCashSessionSummary,
} from "@gestao-de-quadras/core/pdv";
import { OpenCashCard } from "./_components/open-cash-card";
import { CashDashboard } from "./_components/cash-dashboard";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CaixaPage() {
  const { ctx } = await requireModule("pdv");

  const openSession = await getCurrentOpenCashSession(ctx);
  const summary = openSession ? await getCashSessionSummary(ctx, openSession.id) : null;

  return (
    <>
      <header className="h-14 shrink-0 px-6 flex items-center justify-between bg-white border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <Link
            href="/pdv"
            className="inline-flex items-center text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text-1)]"
          >
            <ChevronLeft className="size-4 mr-0.5" /> Voltar ao PDV
          </Link>
          <span className="text-[var(--border)]">|</span>
          <h1 className="text-base font-semibold text-[var(--text-1)]">Turno e Gestão de Caixa</h1>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-auto p-6">
        {!summary ? <OpenCashCard /> : <CashDashboard summary={summary} />}
      </main>
    </>
  );
}
