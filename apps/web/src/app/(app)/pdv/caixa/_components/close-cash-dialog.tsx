"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCentsToBRL } from "@/lib/currency";
import { closeCashSessionAction } from "../_actions/close-cash-session.action";

type PaymentMethodKey = "dinheiro" | "pix" | "cartao_credito" | "cartao_debito" | "pontos";

const METHOD_LABELS: Record<PaymentMethodKey, string> = {
  dinheiro: "Dinheiro (Gaveta)",
  pix: "Pix",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  pontos: "Pontos / Cashback",
};

export function CloseCashDialog({
  open,
  onOpenChange,
  cashSessionId,
  expectedByMethod,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cashSessionId: string;
  expectedByMethod: Record<string, number>;
}) {
  const router = useRouter();

  // Armazena a contagem física digitada pelo operador em texto (para manipulação R$)
  const [countsStr, setCountsStr] = useState<Record<PaymentMethodKey, string>>({
    dinheiro: formatCentsToBRL(expectedByMethod.dinheiro ?? 0).replace("R$", "").trim(),
    pix: formatCentsToBRL(expectedByMethod.pix ?? 0).replace("R$", "").trim(),
    cartao_credito: formatCentsToBRL(expectedByMethod.cartao_credito ?? 0).replace("R$", "").trim(),
    cartao_debito: formatCentsToBRL(expectedByMethod.cartao_debito ?? 0).replace("R$", "").trim(),
    pontos: formatCentsToBRL(expectedByMethod.pontos ?? 0).replace("R$", "").trim(),
  });

  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseToCents = (val: string): number => {
    if (!val) return 0;
    const cleaned = val.replace(/\./g, "").replace(",", ".").replace(/[^0-9.]/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.round(num * 100);
  };

  const methods: PaymentMethodKey[] = ["dinheiro", "pix", "cartao_credito", "cartao_debito", "pontos"];

  // Calcula totais em tempo real
  let totalExpected = 0;
  let totalCounted = 0;

  methods.forEach((m) => {
    const exp = expectedByMethod[m] ?? 0;
    const cnt = parseToCents(countsStr[m] ?? "0");
    totalExpected += exp;
    totalCounted += cnt;
  });

  const totalDiff = totalCounted - totalExpected;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    const countsPayload = methods.map((m) => ({
      paymentMethod: m,
      countedCents: parseToCents(countsStr[m] ?? "0"),
    }));

    const res = await closeCashSessionAction({
      cashSessionId,
      counts: countsPayload,
      closingNotes: notes.trim() || undefined,
    });

    if (!res.success) {
      setError(res.error ?? "Não foi possível fechar o caixa.");
      setIsSubmitting(false);
      return;
    }

    router.refresh();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fechamento e Conferência de Caixa</DialogTitle>
          <DialogDescription>
            Digite os valores físicos contados na gaveta e comprovantes para cruzar com os valores esperados.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-3 rounded-[var(--radius-control)] text-xs font-medium bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)]">
              {error}
            </div>
          )}

          {/* Tabela de Conferência */}
          <div className="border border-[var(--border)] rounded-[var(--radius-card)] overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--bg-sunken)] text-left font-bold text-[var(--text-2)] border-b border-[var(--border)]">
                  <th className="p-2.5">MEIO DE PAGAMENTO</th>
                  <th className="p-2.5 text-right">ESPERADO</th>
                  <th className="p-2.5 text-right">CONTADO FÍSICO</th>
                  <th className="p-2.5 text-right">DIFERENÇA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {methods.map((m) => {
                  const expected = expectedByMethod[m] ?? 0;
                  const counted = parseToCents(countsStr[m] ?? "0");
                  const diff = counted - expected;

                  return (
                    <tr key={m} className="hover:bg-gray-50/50">
                      <td className="p-2.5 font-semibold text-[var(--text-1)]">
                        {METHOD_LABELS[m]}
                      </td>
                      <td className="p-2.5 text-right font-medium text-[var(--text-2)] tabular-nums">
                        {formatCentsToBRL(expected)}
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="text"
                          value={countsStr[m] ?? ""}
                          onChange={(e) =>
                            setCountsStr((prev) => ({ ...prev, [m]: e.target.value }))
                          }
                          className="w-28 h-8 px-2 text-right font-bold text-xs bg-white border border-[var(--border)] rounded outline-none focus:border-[var(--accent)]"
                        />
                      </td>
                      <td
                        className={`p-2.5 text-right font-bold tabular-nums ${
                          diff === 0
                            ? "text-[var(--text-3)]"
                            : diff > 0
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {diff === 0 ? "OK" : `${diff > 0 ? "+" : ""}${formatCentsToBRL(diff)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Resumo da Diferença Total */}
          <div
            className={`p-3 rounded-[var(--radius-card)] border flex items-center justify-between text-xs ${
              totalDiff === 0
                ? "bg-gray-50 border-[var(--border)] text-[var(--text-1)]"
                : totalDiff > 0
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-red-50 border-red-200 text-red-900"
            }`}
          >
            <div>
              <span className="font-bold uppercase tracking-wide block">
                {totalDiff === 0
                  ? "Conferência Exata"
                  : totalDiff > 0
                  ? "Sobra de Caixa"
                  : "Quebra de Caixa"}
              </span>
              <span className="text-[11px] opacity-80">
                Esperado: {formatCentsToBRL(totalExpected)} · Contado: {formatCentsToBRL(totalCounted)}
              </span>
            </div>
            <span className="text-base font-extrabold tabular-nums">
              {totalDiff === 0 ? "R$ 0,00" : `${totalDiff > 0 ? "+" : ""}${formatCentsToBRL(totalDiff)}`}
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-2)] block">
              Observações do Fechamento (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Quebra de R$ 2,00 referente a troco em moedas / Observações adicionais"
              rows={2}
              className="w-full p-2.5 text-xs text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-control)] outline-none focus:border-[var(--accent)] resize-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
            >
              {isSubmitting ? "Encerrando…" : "Confirmar Fechamento de Caixa"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
