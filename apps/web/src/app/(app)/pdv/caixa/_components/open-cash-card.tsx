"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DollarSign, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openCashSessionAction } from "../_actions/open-cash-session.action";

export function OpenCashCard() {
  const router = useRouter();
  const [initialCashStr, setInitialCashStr] = useState("0,00");
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

    setIsSubmitting(true);
    setError(null);

    const initialCashCents = parseToCents(initialCashStr);
    const res = await openCashSessionAction({ initialCashCents });

    if (!res.success) {
      setError(res.error ?? "Não foi possível abrir o caixa.");
      setIsSubmitting(false);
      return;
    }

    router.refresh();
  }

  return (
    <div className="max-w-lg mx-auto my-8 bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[var(--border)]">
        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <Lock className="size-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-[var(--text-1)]">Caixa Fechado</h2>
          <p className="text-xs text-[var(--text-3)]">
            Abra a sessão de caixa informando o valor do troco inicial em gaveta.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-[var(--radius-control)] text-xs font-medium bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)]">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[var(--text-2)] block">
            Saldo Inicial de Troco em Dinheiro (R$)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--text-3)]">
              R$
            </span>
            <input
              type="text"
              value={initialCashStr}
              onChange={(e) => setInitialCashStr(e.target.value)}
              placeholder="0,00"
              required
              className="w-full h-11 pl-10 pr-4 text-base font-bold text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-control)] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <p className="text-[11px] text-[var(--text-3)]">
            Exemplo: R$ 100,00 em notas e moedas de troco inicial.
          </p>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold text-sm"
        >
          {isSubmitting ? "Abrindo Caixa…" : "Abrir Sessão de Caixa"}
        </Button>
      </form>
    </div>
  );
}
