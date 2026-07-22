"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCentsToBRL } from "@/lib/currency";
import { getCashSessionSummaryAction, closeCashSessionAction } from "../_actions/cash-session.actions";
import type { CashSessionSummary } from "@gestao-de-quadras/core/pdv";

interface CloseCashDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cashSessionId: string;
  onSuccess: () => void;
}

type MethodKey = "dinheiro" | "pix" | "cartao_credito" | "cartao_debito" | "pontos";

const METHOD_LABELS: Record<MethodKey, string> = {
  dinheiro: "Dinheiro em Gaveta",
  pix: "Pix",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  pontos: "Pontos / Cashback",
};

export function CloseCashDialog({
  open,
  onOpenChange,
  cashSessionId,
  onSuccess,
}: CloseCashDialogProps) {
  const [summary, setSummary] = useState<CashSessionSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [countsStr, setCountsStr] = useState<Record<MethodKey, string>>({
    dinheiro: "0,00",
    pix: "0,00",
    cartao_credito: "0,00",
    cartao_debito: "0,00",
    pontos: "0,00",
  });
  const [closingNotes, setClosingNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open && cashSessionId) {
      setIsLoadingSummary(true);
      setErrorMessage(null);
      void getCashSessionSummaryAction(cashSessionId).then((res) => {
        setSummary(res);
        if (res) {
          // Preenche os valores contados inicialmente com os valores esperados para agilizar
          const initial: Record<MethodKey, string> = {
            dinheiro: (res.expectedByMethod.dinheiro / 100).toFixed(2).replace(".", ","),
            pix: (res.expectedByMethod.pix / 100).toFixed(2).replace(".", ","),
            cartao_credito: (res.expectedByMethod.cartao_credito / 100).toFixed(2).replace(".", ","),
            cartao_debito: (res.expectedByMethod.cartao_debito / 100).toFixed(2).replace(".", ","),
            pontos: (res.expectedByMethod.pontos / 100).toFixed(2).replace(".", ","),
          };
          setCountsStr(initial);
        }
        setIsLoadingSummary(false);
      });
    }
  }, [open, cashSessionId]);

  function parseCents(valueStr: string): number {
    const cleaned = valueStr.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    if (isNaN(num) || num < 0) return 0;
    return Math.round(num * 100);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!summary || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const countsPayload = (Object.keys(METHOD_LABELS) as MethodKey[]).map((method) => ({
        paymentMethod: method,
        countedCents: parseCents(countsStr[method] ?? "0"),
      }));

      const result = await closeCashSessionAction(cashSessionId, countsPayload, closingNotes);
      if (!result.success) {
        setErrorMessage("Não foi possível fechar a sessão de caixa.");
        setIsSubmitting(false);
        return;
      }

      onSuccess();
      onOpenChange(false);
    } catch {
      setErrorMessage("Erro ao encerrar sessão de caixa. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fechamento e Conferência de Caixa</DialogTitle>
          <DialogDescription>
            Confira a contagem física dos valores por meio de pagamento para encerrar o turno.
          </DialogDescription>
        </DialogHeader>

        {isLoadingSummary ? (
          <div className="py-8 text-center text-xs text-[var(--text-3)]">
            Carregando resumo financeiro do caixa...
          </div>
        ) : !summary ? (
          <div className="py-8 text-center text-xs text-[var(--danger)] font-medium">
            Não foi possível carregar os dados da sessão de caixa.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
            {errorMessage && (
              <div
                className="p-3 rounded-[var(--radius-control)] font-medium"
                style={{
                  backgroundColor: "var(--danger-bg)",
                  border: "1px solid var(--danger-border)",
                  color: "var(--danger)",
                }}
              >
                {errorMessage}
              </div>
            )}

            {/* Resumo da Sessão */}
            <div className="p-3 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-[var(--radius-card)] space-y-1">
              <div className="flex justify-between text-[var(--text-2)] font-medium">
                <span>Saldo Inicial (Troco):</span>
                <span>{formatCentsToBRL(summary.cashSession.initialCashCents)}</span>
              </div>
              <div className="flex justify-between text-[var(--text-3)]">
                <span>Movimentações Manuais:</span>
                <span>
                  {summary.movements.length === 1
                    ? "1 movimentação"
                    : `${summary.movements.length} movimentações`}
                </span>
              </div>
            </div>

            {/* Tabela de Conferência Física */}
            <div className="space-y-2">
              <label className="font-bold text-[var(--text-2)] uppercase tracking-wider block">
                Valores Contados vs Esperados
              </label>

              {(Object.keys(METHOD_LABELS) as MethodKey[]).map((method) => {
                const expected = summary.expectedByMethod[method] ?? 0;
                const counted = parseCents(countsStr[method] ?? "0");
                const diff = counted - expected;

                return (
                  <div
                    key={method}
                    className="p-3 border border-[var(--border)] rounded-[var(--radius-card)] bg-white grid grid-cols-1 sm:grid-cols-3 gap-2 items-center"
                  >
                    <div>
                      <span className="font-bold text-[var(--text-1)] block">
                        {METHOD_LABELS[method]}
                      </span>
                      <span className="text-[var(--text-3)]">
                        Esperado: {formatCentsToBRL(expected)}
                      </span>
                    </div>

                    <div>
                      <label className="text-[10px] text-[var(--text-3)] block mb-0.5">
                        Valor Contado (R$)
                      </label>
                      <input
                        type="text"
                        value={countsStr[method]}
                        onChange={(e) =>
                          setCountsStr((prev) => ({ ...prev, [method]: e.target.value }))
                        }
                        className="w-full h-8 px-2 bg-white border border-[var(--border)] rounded text-right font-semibold outline-none focus:border-[var(--accent)]"
                      />
                    </div>

                    <div className="text-right sm:text-right flex sm:flex-col justify-between sm:justify-center items-center sm:items-end">
                      <span className="text-[10px] text-[var(--text-3)]">Diferença</span>
                      <span
                        className={`font-bold text-xs ${
                          diff === 0
                            ? "text-[var(--text-3)]"
                            : diff > 0
                            ? "text-emerald-700 font-bold"
                            : "text-[var(--danger)] font-bold"
                        }`}
                      >
                        {diff === 0
                          ? "Exato (R$ 0,00)"
                          : diff > 0
                          ? `+ ${formatCentsToBRL(diff)} (Sobra)`
                          : `- ${formatCentsToBRL(Math.abs(diff))} (Quebra)`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Observações de Fechamento */}
            <div>
              <label className="font-bold text-[var(--text-2)] block mb-1">
                Observações do Fechamento (Opcional)
              </label>
              <textarea
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="Ex.: Sobra de R$ 5 em moedas devido a arredondamento."
                rows={2}
                className="w-full p-2.5 bg-white border border-[var(--border)] rounded-[var(--radius-control)] outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {isSubmitting ? "Encerrando..." : "Confirmar e Fechar Caixa"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
