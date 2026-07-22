"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCentsToBRL } from "@/lib/currency";
import { getCustomerDebitSummaryAction, settleCustomerDebitAction } from "../_actions/customer-debit.actions";
import type { CustomerDebitSummary } from "@gestao-de-quadras/core/pdv";

interface SettleDebitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  onSuccess: () => void;
}

type MethodKey = "dinheiro" | "pix" | "cartao_credito" | "cartao_debito" | "pontos";

const METHOD_LABELS: Record<MethodKey, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  pontos: "Pontos / Cashback",
};

export function SettleDebitDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  onSuccess,
}: SettleDebitDialogProps) {
  const [summary, setSummary] = useState<CustomerDebitSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<MethodKey>("pix");
  const [amountStr, setAmountStr] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open && customerId) {
      setIsLoading(true);
      setErrorMessage(null);
      void getCustomerDebitSummaryAction(customerId).then((res) => {
        setSummary(res);
        if (res && res.totalPendingCents > 0) {
          setAmountStr((res.totalPendingCents / 100).toFixed(2).replace(".", ","));
        }
        setIsLoading(false);
      });
    }
  }, [open, customerId]);

  function parseCents(valueStr: string): number {
    const cleaned = valueStr.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    if (isNaN(num) || num <= 0) return 0;
    return Math.round(num * 100);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = parseCents(amountStr);
    if (amountCents <= 0) {
      setErrorMessage("Informe um valor de quitação válido maior que zero.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await settleCustomerDebitAction(customerId, [
        { paymentMethod: selectedMethod, amountCents },
      ]);

      if (!result.success) {
        setErrorMessage("Não foi possível registrar a quitação do saldo devedor.");
        setIsSubmitting(false);
        return;
      }

      onSuccess();
      onOpenChange(false);
    } catch {
      setErrorMessage("Erro ao processar quitação. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quitação de Saldo Devedor</DialogTitle>
          <DialogDescription>
            Receba o pagamento total ou parcial da conta do cliente <strong className="text-[var(--text-1)]">{customerName}</strong>.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-6 text-center text-xs text-[var(--text-3)]">
            Consultando histórico de débitos do cliente...
          </div>
        ) : !summary || summary.totalPendingCents <= 0 ? (
          <div className="py-6 text-center text-xs text-[var(--text-3)]">
            Este cliente não possui saldos devedores pendentes.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {errorMessage && (
              <div
                className="p-3 rounded-[var(--radius-control)] text-xs font-medium"
                style={{
                  backgroundColor: "var(--danger-bg)",
                  border: "1px solid var(--danger-border)",
                  color: "var(--danger)",
                }}
              >
                {errorMessage}
              </div>
            )}

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-[var(--radius-card)] flex justify-between items-center text-xs">
              <span className="font-semibold text-amber-900">Total Pendente:</span>
              <span className="font-bold text-base text-amber-950">
                {formatCentsToBRL(summary.totalPendingCents)}
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--text-2)] block mb-1">
                Meio de Pagamento
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.keys(METHOD_LABELS) as MethodKey[]).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setSelectedMethod(method)}
                    className={`py-2 px-2 text-xs font-semibold rounded border transition-all ${
                      selectedMethod === method
                        ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm"
                        : "bg-white text-[var(--text-2)] border-[var(--border)] hover:border-[var(--accent)]"
                    }`}
                  >
                    {METHOD_LABELS[method]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--text-2)] block mb-1">
                Valor a Quitar (R$)
              </label>
              <input
                type="text"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0,00"
                required
                className="w-full h-11 px-3 bg-white border border-[var(--border)] rounded-[var(--radius-control)] font-bold text-lg text-right outline-none focus:border-[var(--accent)]"
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
                {isSubmitting ? "Registrando..." : "Confirmar Quitação"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
