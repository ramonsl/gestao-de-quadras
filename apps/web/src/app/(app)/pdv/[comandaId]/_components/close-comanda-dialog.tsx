"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCentsToBRL } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { closeComandaAction } from "../_actions/close-comanda.action";
import { getCustomerPointsSummaryAction } from "../../_actions/points.actions";
import type { CustomerPointsSummary } from "@gestao-de-quadras/core/points";
import type { PaymentMethodEnum } from "@gestao-de-quadras/core/pdv";
import type { z } from "zod";

type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

interface PaymentRowState {
  id: string;
  method: PaymentMethod;
  amountStr: string;
  receivedStr: string;
}

interface CloseComandaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comandaId: string;
  totalCents: number;
  customerId?: string | null;
  onTransferToDebit?: () => void;
  onSuccess: () => void;
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: "Pix",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  dinheiro: "Dinheiro",
  pontos: "Pontos / Cashback",
};

export function CloseComandaDialog({
  open,
  onOpenChange,
  comandaId,
  totalCents,
  customerId,
  onTransferToDebit,
  onSuccess,
}: CloseComandaDialogProps) {
  const initialAmountStr = (totalCents / 100).toFixed(2).replace(".", ",");
  const [payments, setPayments] = useState<PaymentRowState[]>([
    { id: "1", method: "pix", amountStr: initialAmountStr, receivedStr: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pointsSummary, setPointsSummary] = useState<CustomerPointsSummary | null>(null);

  useEffect(() => {
    if (open && customerId) {
      void getCustomerPointsSummaryAction(customerId, totalCents).then((res) => {
        setPointsSummary(res);
      });
    } else {
      setPointsSummary(null);
    }
  }, [open, customerId, totalCents]);

  // Helper para converter "12,50" -> 1250 centavos
  function parseCents(valueStr: string): number {
    const cleaned = valueStr.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    if (isNaN(num) || num < 0) return 0;
    return Math.round(num * 100);
  }

  const { totalAllocatedCents, totalChangeCents, isValid } = useMemo(() => {
    let allocated = 0;
    let change = 0;
    let valid = true;

    for (const p of payments) {
      const amt = parseCents(p.amountStr);
      if (amt <= 0) valid = false;
      allocated += amt;

      if (p.method === "dinheiro") {
        const rec = p.receivedStr ? parseCents(p.receivedStr) : amt;
        if (rec < amt) {
          valid = false;
        } else {
          change += rec - amt;
        }
      }
    }

    if (allocated < totalCents) valid = false;

    return {
      totalAllocatedCents: allocated,
      totalChangeCents: change,
      isValid: valid && payments.length > 0,
    };
  }, [payments, totalCents]);

  const remainingCents = Math.max(0, totalCents - totalAllocatedCents);

  function handleAddPaymentRow() {
    const remainingStr = remainingCents > 0
      ? (remainingCents / 100).toFixed(2).replace(".", ",")
      : "0,00";

    setPayments((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        method: "cartao_credito",
        amountStr: remainingStr,
        receivedStr: "",
      },
    ]);
  }

  function handleRemovePaymentRow(id: string) {
    setPayments((prev) => prev.filter((p) => p.id !== id));
  }

  function handleUpdatePaymentRow(id: string, field: keyof PaymentRowState, value: string) {
    setPayments((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  }

  async function handleConfirmClose() {
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = payments.map((p) => {
        const amt = parseCents(p.amountStr);
        const rec = p.method === "dinheiro" && p.receivedStr ? parseCents(p.receivedStr) : undefined;
        return {
          paymentMethod: p.method,
          amountCents: amt,
          receivedCents: rec,
        };
      });

      const result = await closeComandaAction(comandaId, payload);
      if (!result.success) {
        setErrorMessage(
          result.reason === "insufficient_payment"
            ? "O valor total pago é menor que o valor da comanda."
            : result.reason === "invalid_cash_received"
            ? "O valor em dinheiro recebido é menor que o valor cobrado."
            : result.reason === "points_disabled"
            ? "O programa de pontos está desativado nesta arena."
            : result.reason === "points_anonymous_comanda"
            ? "Não é possível resgatar pontos em comandas de venda balcão (sem cliente identificado)."
            : result.reason === "points_insufficient_balance"
            ? "O cliente não possui saldo de pontos suficiente para este valor de resgate."
            : result.reason === "points_exceed_max_redemption"
            ? "O valor em pontos excede o limite máximo de abatimento permitido para esta comanda."
            : "Não foi possível fechar a comanda. Verifique os valores."
        );
        setIsSubmitting(false);
        return;
      }

      onSuccess();
      onOpenChange(false);
    } catch {
      setErrorMessage("Erro ao processar fechamento. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Fechamento e Pagamento da Comanda</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Card de Resumo de Valores */}
          <div className="p-3.5 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-[var(--radius-card)] space-y-1.5 text-sm">
            <div className="flex justify-between font-medium text-[var(--text-2)]">
              <span>Total da Comanda:</span>
              <span className="font-bold text-[var(--text-1)]">{formatCentsToBRL(totalCents)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-3)]">Total Alocado nos Pagamentos:</span>
              <span className={totalAllocatedCents >= totalCents ? "text-emerald-600 font-bold" : "font-semibold"}>
                {formatCentsToBRL(totalAllocatedCents)}
              </span>
            </div>
            {remainingCents > 0 && (
              <div className="flex justify-between text-xs font-semibold text-[var(--danger)] pt-1 border-t border-[var(--border)]">
                <span>Falta Alocar:</span>
                <span>{formatCentsToBRL(remainingCents)}</span>
              </div>
            )}
            {totalChangeCents > 0 && (
              <div className="flex justify-between text-xs font-bold text-emerald-700 pt-1 border-t border-[var(--border)]">
                <span>Troco a Devolver:</span>
                <span>{formatCentsToBRL(totalChangeCents)}</span>
              </div>
            )}
          </div>

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

          {customerId && onTransferToDebit && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-[var(--radius-card)] flex items-center justify-between gap-2 text-xs text-amber-900">
              <div>
                <p className="font-bold">Cliente Identificado</p>
                <p className="text-[11px] text-amber-800">
                  Deseja lançar este valor como saldo devedor na conta do cliente?
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onTransferToDebit();
                }}
                className="bg-white border-amber-300 hover:bg-amber-100 text-amber-950 text-xs shrink-0 font-bold"
              >
                📋 Saldo Devedor
              </Button>
            </div>
          )}

          {/* Formas de Pagamento Adicionadas */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase text-[var(--text-3)]">
              Formas de Pagamento
            </label>

            {payments.map((row, idx) => (
              <div
                key={row.id}
                className="p-3 border border-[var(--border)] rounded-[var(--radius-card)] bg-white space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--text-2)]">Forma #{idx + 1}</span>
                  {payments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePaymentRow(row.id)}
                      className="text-[var(--danger)] hover:underline"
                    >
                      Remover
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[var(--text-3)] block mb-0.5">Meio</label>
                    <select
                      value={row.method}
                      onChange={(e) =>
                        handleUpdatePaymentRow(row.id, "method", e.target.value as PaymentMethod)
                      }
                      className="w-full h-9 px-2 bg-white border border-[var(--border)] rounded text-xs outline-none focus:border-[var(--accent)]"
                    >
                      {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
                        <option key={m} value={m}>
                          {PAYMENT_LABELS[m]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-[var(--text-3)] block mb-0.5">
                      Valor a Cobrar (R$)
                    </label>
                    <input
                      type="text"
                      value={row.amountStr}
                      onChange={(e) => handleUpdatePaymentRow(row.id, "amountStr", e.target.value)}
                      placeholder="0,00"
                      className="w-full h-9 px-2 bg-white border border-[var(--border)] rounded text-xs outline-none font-semibold focus:border-[var(--accent)] text-right"
                    />
                  </div>
                </div>

                {row.method === "pontos" && (
                  <div className="pt-1.5 border-t border-dashed border-[var(--border)] space-y-1">
                    {!customerId ? (
                      <p className="text-[11px] text-[var(--danger)] font-medium">
                        ⚠️ O resgate de pontos só está disponível para comandas com cliente identificado.
                      </p>
                    ) : pointsSummary ? (
                      !pointsSummary.enabled ? (
                        <p className="text-[11px] text-[var(--danger)] font-medium">
                          ⚠️ O programa de pontos está desativado nas configurações desta arena.
                        </p>
                      ) : (
                        <div className="p-2 bg-emerald-50/70 border border-emerald-200 rounded text-[11px] text-emerald-950 space-y-0.5">
                          <div className="flex justify-between font-bold">
                            <span>Saldo do Cliente:</span>
                            <span>
                              {pointsSummary.balancePoints} pts (
                              {formatCentsToBRL(pointsSummary.balanceValueCents)})
                            </span>
                          </div>
                          <div className="flex justify-between text-[10px] text-emerald-800">
                            <span>Limite de Resgate nesta Comanda:</span>
                            <span className="font-bold">
                              {formatCentsToBRL(pointsSummary.maxAllowedRedemptionCents)}
                            </span>
                          </div>
                        </div>
                      )
                    ) : (
                      <p className="text-[11px] text-[var(--text-3)]">
                        Consultando saldo de pontos do cliente...
                      </p>
                    )}
                  </div>
                )}

                {row.method === "dinheiro" && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-dashed border-[var(--border)]">
                    <div>
                      <label className="text-[10px] text-[var(--text-3)] block mb-0.5">
                        Valor Recebido (R$)
                      </label>
                      <input
                        type="text"
                        value={row.receivedStr}
                        onChange={(e) => handleUpdatePaymentRow(row.id, "receivedStr", e.target.value)}
                        placeholder={row.amountStr}
                        className="w-full h-8 px-2 bg-emerald-50/50 border border-emerald-300 rounded text-xs outline-none text-right font-medium"
                      />
                    </div>
                    <div className="flex flex-col justify-center text-right">
                      <span className="text-[10px] text-[var(--text-3)]">Troco Desta Forma</span>
                      <span className="font-bold text-xs text-emerald-700">
                        {formatCentsToBRL(
                          Math.max(
                            0,
                            (row.receivedStr ? parseCents(row.receivedStr) : parseCents(row.amountStr)) -
                              parseCents(row.amountStr)
                          )
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddPaymentRow}
              className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              + Dividir / Adicionar outro meio de pagamento
            </button>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!isValid || isSubmitting}
              onClick={() => void handleConfirmClose()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {isSubmitting ? "Finalizando..." : "Finalizar e Fechar Comanda"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

