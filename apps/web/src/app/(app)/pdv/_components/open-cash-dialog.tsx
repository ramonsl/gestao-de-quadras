"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { openCashSessionAction } from "../_actions/cash-session.actions";
import type { CashSession } from "@gestao-de-quadras/db/schema";

interface OpenCashDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenedSuccess: (session: CashSession) => void;
}

export function OpenCashDialog({ open, onOpenChange, onOpenedSuccess }: OpenCashDialogProps) {
  const [initialCashStr, setInitialCashStr] = useState("100,00");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function parseCents(valueStr: string): number {
    const cleaned = valueStr.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    if (isNaN(num) || num < 0) return 0;
    return Math.round(num * 100);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const initialCents = parseCents(initialCashStr);
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await openCashSessionAction(initialCents);
      if (!result.success) {
        setErrorMessage(
          result.reason === "already_open"
            ? "Já existe um caixa aberto nesta arena."
            : "Não foi possível abrir o caixa."
        );
        setIsSubmitting(false);
        return;
      }

      onOpenedSuccess(result.cashSession);
      onOpenChange(false);
    } catch {
      setErrorMessage("Erro ao abrir o caixa. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Abertura de Caixa (Turno)</DialogTitle>
          <DialogDescription>
            Informe o valor do saldo inicial em dinheiro (troco) disponível na gaveta do caixa.
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

          <div>
            <label className="text-xs font-bold text-[var(--text-2)] block mb-1">
              Saldo Inicial em Dinheiro / Troco (R$)
            </label>
            <input
              type="text"
              value={initialCashStr}
              onChange={(e) => setInitialCashStr(e.target.value)}
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
              {isSubmitting ? "Abrindo..." : "Abrir Caixa"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
