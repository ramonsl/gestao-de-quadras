"use client";

import { useState } from "react";
import type { CashSessionSummary } from "@gestao-de-quadras/core/pdv";
import { formatCentsToBRL } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { DollarSign, ArrowDownRight, ArrowUpRight, Lock, History } from "lucide-react";
import { CashMovementDialog } from "./cash-movement-dialog";
import { CloseCashDialog } from "./close-cash-dialog";

export function CashDashboard({ summary }: { summary: CashSessionSummary }) {
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);
  const [movementDefaultType, setMovementDefaultType] = useState<"sangria" | "suprimento">("sangria");
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  const session = summary.cashSession;
  const movements = summary.movements;
  const expected = summary.expectedByMethod;

  const initialCents = session.initialCashCents;

  const totalSuprimentosCents = movements
    .filter((m) => m.type === "suprimento")
    .reduce((acc: number, m) => acc + m.amountCents, 0);

  const totalSangriasCents = movements
    .filter((m) => m.type === "sangria")
    .reduce((acc: number, m) => acc + m.amountCents, 0);

  const cashDrawerExpected = expected.dinheiro ?? 0;

  const openMovementModal = (t: "sangria" | "suprimento") => {
    setMovementDefaultType(t);
    setMovementDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Status */}
      <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
            <DollarSign className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[var(--text-1)]">Caixa Aberto</span>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full uppercase">
                Em Operação
              </span>
            </div>
            <p className="text-xs text-[var(--text-3)]">
              Aberto em {new Date(session.openedAt).toLocaleString("pt-BR")}
            </p>
          </div>
        </div>

        {/* Botões de Ação Principal */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => openMovementModal("suprimento")}
            className="text-xs font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50"
          >
            <ArrowUpRight className="size-3.5 mr-1" /> + Suprimento
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => openMovementModal("sangria")}
            className="text-xs font-semibold text-red-700 border-red-300 hover:bg-red-50"
          >
            <ArrowDownRight className="size-3.5 mr-1" /> - Sangria
          </Button>

          <Button
            type="button"
            onClick={() => setCloseDialogOpen(true)}
            className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Lock className="size-3.5 mr-1" /> Fechar Caixa
          </Button>
        </div>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="SALDO INICIAL DE TROCO"
          value={formatCentsToBRL(initialCents)}
          sub="Dinheiro de abertura"
        />
        <MetricCard
          label="GAVETA ESPERADA (DINHEIRO)"
          value={formatCentsToBRL(cashDrawerExpected)}
          sub={`Troco + Vendas + Supr. - Sangrias`}
          highlight
        />
        <MetricCard
          label="OUTROS MEIOS (PIX/CARTÃO)"
          value={formatCentsToBRL(
            (expected.pix ?? 0) + (expected.cartao_credito ?? 0) + (expected.cartao_debito ?? 0)
          )}
          sub="Registrados no sistema"
        />
        <MetricCard
          label="TOTAL ESPERADO GERAL"
          value={formatCentsToBRL(summary.totalExpectedCents)}
          sub="Soma de todos os meios"
        />
      </div>

      {/* Detalhamento por Meio de Pagamento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)] mb-3">
            Resumo Esperado por Meio de Pagamento
          </h3>
          <div className="space-y-2 text-xs">
            <PaymentRow label="Dinheiro (Gaveta)" value={expected.dinheiro ?? 0} />
            <PaymentRow label="Pix" value={expected.pix ?? 0} />
            <PaymentRow label="Cartão de Crédito" value={expected.cartao_credito ?? 0} />
            <PaymentRow label="Cartão de Débito" value={expected.cartao_debito ?? 0} />
            <PaymentRow label="Pontos / Cashback" value={expected.pontos ?? 0} />
          </div>
        </div>

        {/* Histórico de Sangrias e Suprimentos */}
        <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-3)] flex items-center gap-1.5">
              <History className="size-3.5" /> Sangrias e Suprimentos ({movements.length})
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto max-h-48 space-y-2">
            {movements.length === 0 ? (
              <p className="text-xs text-[var(--text-3)] text-center py-6">
                Nenhuma sangria ou suprimento registrado nesta sessão.
              </p>
            ) : (
              movements.map((m) => (
                <div
                  key={m.id}
                  className="p-2 rounded border border-[var(--border-soft)] bg-[var(--bg-sunken)] flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-1.5 font-semibold text-[var(--text-1)]">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          m.type === "sangria"
                            ? "bg-red-100 text-red-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {m.type === "sangria" ? "SANGRIA" : "SUPRIMENTO"}
                      </span>
                      <span>{m.reason}</span>
                    </div>
                    <span className="text-[10px] text-[var(--text-3)]">
                      {new Date(m.createdAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <span
                    className={`font-bold tabular-nums ${
                      m.type === "sangria" ? "text-red-600" : "text-emerald-600"
                    }`}
                  >
                    {m.type === "sangria" ? "-" : "+"}{formatCentsToBRL(m.amountCents)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modais */}
      {movementDialogOpen && (
        <CashMovementDialog
          open={movementDialogOpen}
          onOpenChange={setMovementDialogOpen}
          cashSessionId={session.id}
          defaultType={movementDefaultType}
        />
      )}

      {closeDialogOpen && (
        <CloseCashDialog
          open={closeDialogOpen}
          onOpenChange={setCloseDialogOpen}
          cashSessionId={session.id}
          expectedByMethod={expected}
        />
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-3.5 rounded-[var(--radius-card)] border ${
        highlight
          ? "bg-[var(--accent-tint-soft)] border-[var(--accent-tint)]"
          : "bg-white border-[var(--border)]"
      }`}
    >
      <span className="text-[10px] font-bold tracking-wide text-[var(--text-3)] block uppercase">
        {label}
      </span>
      <span
        className={`text-lg font-extrabold tabular-nums block mt-1 ${
          highlight ? "text-[var(--accent-hover)]" : "text-[var(--text-1)]"
        }`}
      >
        {value}
      </span>
      <span className="text-[11px] text-[var(--text-3)] block mt-0.5">{sub}</span>
    </div>
  );
}

function PaymentRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between p-2 rounded bg-[var(--bg-sunken)] border border-[var(--border-soft)]">
      <span className="font-semibold text-[var(--text-2)]">{label}</span>
      <span className="font-bold text-[var(--text-1)] tabular-nums">
        {formatCentsToBRL(value)}
      </span>
    </div>
  );
}
