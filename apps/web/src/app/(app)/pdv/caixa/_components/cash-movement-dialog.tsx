"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { addCashMovementAction } from "../_actions/add-cash-movement.action";

export function CashMovementDialog({
  open,
  onOpenChange,
  cashSessionId,
  defaultType = "sangria",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cashSessionId: string;
  defaultType?: "sangria" | "suprimento";
}) {
  const router = useRouter();
  const [type, setType] = useState<"sangria" | "suprimento">(defaultType);
  const [amountStr, setAmountStr] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseToCents = (val: string): number => {
    const cleaned = val.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.round(num * 100);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    const amountCents = parseToCents(amountStr);
    if (amountCents <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }

    if (!reason.trim() || reason.trim().length < 3) {
      setError("Informe um motivo com pelo menos 3 caracteres.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const res = await addCashMovementAction({
      cashSessionId,
      type,
      amountCents,
      reason: reason.trim(),
    });

    if (!res.success) {
      setError(res.error ?? "Não foi possível registrar a movimentação.");
      setIsSubmitting(false);
      return;
    }

    router.refresh();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Movimentação de Caixa</DialogTitle>
          <DialogDescription>
            Registre retiradas (Sangria) ou aportes extras (Suprimento) em dinheiro.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-3 rounded-[var(--radius-control)] text-xs font-medium bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)]">
              {error}
            </div>
          )}

          {/* Seletor do Tipo */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType("sangria")}
              className={`py-2 px-3 text-xs font-bold rounded-[var(--radius-control)] border transition-all ${
                type === "sangria"
                  ? "bg-red-600 text-white border-red-600 shadow-sm"
                  : "bg-white text-[var(--text-2)] border-[var(--border)] hover:border-red-500"
              }`}
            >
              🔻 Sangria (Retirada)
            </button>
            <button
              type="button"
              onClick={() => setType("suprimento")}
              className={`py-2 px-3 text-xs font-bold rounded-[var(--radius-control)] border transition-all ${
                type === "suprimento"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "bg-white text-[var(--text-2)] border-[var(--border)] hover:border-emerald-500"
              }`}
            >
              🔺 Suprimento (Aporte)
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-2)] block">
              Valor em Dinheiro (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--text-3)]">
                R$
              </span>
              <input
                type="text"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0,00"
                required
                className="w-full h-10 pl-10 pr-4 text-sm font-bold text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-control)] outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-2)] block">
              Motivo / Justificativa
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                type === "sangria"
                  ? "Ex: Pagamento fornecedor bebidas / Recolhimento"
                  : "Ex: Troco adicional colocado pelo gerente"
              }
              required
              className="w-full h-10 px-3 text-sm text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-control)] outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className={`${
                type === "sangria" ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
              } text-white font-bold`}
            >
              {isSubmitting ? "Registrando…" : type === "sangria" ? "Confirmar Sangria" : "Confirmar Suprimento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
