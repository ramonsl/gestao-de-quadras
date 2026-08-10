import type { CustomerProfile360 } from "@gestao-de-quadras/core/customers/customer-profile.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCentsToBRL } from "@/lib/currency";

/** Barramento de Indicadores Chave (CAD-08): 4 cards de resumo financeiro/saldos. */
export function IndicatorCards({ profile }: { profile: CustomerProfile360 }) {
  const { debit, points, classBalances, ltv } = profile;
  const hasDebit = debit.totalPendingCents > 0;
  const remainingClasses = classBalances.reduce((sum, p) => sum + p.remainingClasses, 0);
  const totalClasses = classBalances.reduce((sum, p) => sum + p.totalClassCount, 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {/* Saldo Devedor */}
      <Card
        className={hasDebit ? "border-[var(--danger-border)] bg-[var(--danger-bg)]" : undefined}
      >
        <CardHeader>
          <CardTitle className={hasDebit ? "text-[var(--danger)]" : undefined}>
            Saldo Devedor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p
            className={`text-kpi tabular-nums ${
              hasDebit ? "text-[var(--danger)]" : "text-[var(--text-1)]"
            }`}
          >
            {formatCentsToBRL(debit.totalPendingCents)}
          </p>
          <p className="text-[11px] text-[var(--text-3)]">
            Limite {formatCentsToBRL(debit.limitCents)} · {debit.usagePercent}% utilizado
          </p>
          <div className="h-1.5 rounded-full bg-[var(--border-soft)] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(debit.usagePercent, 100)}%`,
                backgroundColor: debit.isBlocked ? "var(--danger)" : "var(--accent)",
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Pontos & Cashback */}
      <Card>
        <CardHeader>
          <CardTitle>Pontos &amp; Cashback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {points.enabled ? (
            <>
              <p className="text-kpi tabular-nums text-[var(--text-1)]">
                {points.balancePoints.toLocaleString("pt-BR")} pts
              </p>
              <p className="text-[11px] text-[var(--text-3)]">
                ≈ {formatCentsToBRL(points.balanceValueCents)} em cashback
              </p>
            </>
          ) : (
            <p className="text-[13px] text-[var(--text-3)]">Programa de fidelidade inativo</p>
          )}
        </CardContent>
      </Card>

      {/* Pacotes de Aulas */}
      <Card>
        <CardHeader>
          <CardTitle>Pacotes de Aulas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {classBalances.length > 0 ? (
            <>
              <p className="text-kpi tabular-nums text-[var(--text-1)]">
                {remainingClasses}
                <span className="text-sm font-normal text-[var(--text-3)]"> de {totalClasses} aulas</span>
              </p>
              <p className="text-[11px] text-[var(--text-3)]">
                {classBalances.length} pacote{classBalances.length > 1 ? "s" : ""} ativo
                {classBalances.length > 1 ? "s" : ""}
              </p>
            </>
          ) : (
            <p className="text-[13px] text-[var(--text-3)]">Nenhum pacote de aulas ativo</p>
          )}
        </CardContent>
      </Card>

      {/* Resumo de Consumo (LTV) */}
      <Card>
        <CardHeader>
          <CardTitle>Consumo Total (LTV)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-kpi tabular-nums text-[var(--text-1)]">
            {formatCentsToBRL(ltv.totalSpentCents)}
          </p>
          <p className="text-[11px] text-[var(--text-3)]">
            {ltv.comandaCount} comanda{ltv.comandaCount === 1 ? "" : "s"} · {ltv.rentalCount} locações
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
