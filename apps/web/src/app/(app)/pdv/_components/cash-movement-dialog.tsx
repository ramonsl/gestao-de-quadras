"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { addCashMovementAction } from "../_actions/cash-session.actions";

interface CashMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cashSessionId: string;
  onSuccess: () => void;
}

export function CashMovementDialog({
  open,
  onOpenChange,
  cashSessionId,
  onSuccess,
}: CashMovementDialogProps) {
  const [type, setType] = useState<"sangria" | "suprimento">("sangria");
  const [amountStr, setAmountStr] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      setErrorMessage("Informe um valor maior que zero.");
      return;
    }
    if (reason.trim().length < 3) {
      setErrorMessage("Informe o motivo da movimentação (mínimo 3 caracteres).");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await addCashMovementAction(cashSessionId, type, amountCents, reason);
      if (!result.success) {
        setErrorMessage("Não foi possível registrar a movimentação.");
        setIsSubmitting(false);
        return;
      }

      setAmountStr("");
      setReason("");
      onSuccess();
      onOpenChange(false);
    } catch {
      setErrorMessage("Erro ao registrar movimentação. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Movimentação de Caixa</DialogTitle>
          <DialogDescription>
            Lance uma sangria (retirada de dinheiro da gaveta) ou suprimento (reforço de troco).
          </DialogDescription>
        </DialogHeader>

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

          <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--bg-sunken)] rounded-[var(--radius-control)]">
            <button
              type="button"
              onClick={() => setType("sangria")}
              className={`py-2 text-xs font-bold rounded ${
                type === "sangria"
                  ? "bg-white text-[var(--danger)] shadow-sm"
                  : "text-[var(--text-3)] hover:text-[var(--text-1)]"
              }`}
            >
              🔻 Sangria (Retirada)
            </button>
            <button
              type="button"
              onClick={() => setType("suprimento")}
              className={`py-2 text-xs font-bold rounded ${
                type === "suprimento"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-[var(--text-3)] hover:text-[var(--text-1)]"
              }`}
            >
              🔺 Suprimento (Entrada)
            </button>
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--text-2)] block mb-1">
              Valor (R$)
            </label>
            <input
              type="text"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0,00"
              required
              className="w-full h-10 px-3 bg-white border border-[var(--border)] rounded-[var(--radius-control)] font-bold text-base text-right outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--text-2)] block mb-1">
              Motivo / Justificativa
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                type === "sangria"
                  ? "Ex.: Pagamento a fornecedor de gelo"
                  : "Ex.: Reforço de notas de R$ 5 para troco"
              }
              required
              className="w-full h-10 px-3 bg-white border border-[var(--border)] rounded-[var(--radius-control)] text-xs outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="font-bold">
              {isSubmitting ? "Registrando..." : "Confirmar Movimentação"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
