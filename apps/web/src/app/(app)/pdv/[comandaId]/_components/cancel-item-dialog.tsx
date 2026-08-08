"use client";

import { useState } from "react";
import { formatCentsToBRL } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cancelItemAction } from "../_actions/cancel-item.action";

interface CancelItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comandaId: string;
  comandaItemId: string;
  itemProductName: string;
  itemQuantity: number;
  itemTotalPriceCents: number;
  userRole?: string;
  onSuccess: () => void;
}

export function CancelItemDialog({
  open,
  onOpenChange,
  comandaId,
  comandaItemId,
  itemProductName,
  itemQuantity,
  itemTotalPriceCents,
  userRole,
  onSuccess,
}: CancelItemDialogProps) {
  const [reason, setReason] = useState("");
  const [supervisorPassword, setSupervisorPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isAtendente = userRole === "atendente";

  async function handleConfirmCancel() {
    if (reason.trim().length < 5) {
      setErrorMessage("A justificativa deve ter no mínimo 5 caracteres.");
      return;
    }
    if (isAtendente && !supervisorPassword) {
      setErrorMessage("Informe a senha do supervisor para autorizar.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await cancelItemAction(comandaId, comandaItemId, reason, supervisorPassword);
      if (!res.success) {
        setErrorMessage(
          res.reason === "invalid_supervisor_password" || res.reason === "unauthorized"
            ? "Senha de supervisor inválida ou incorreta."
            : res.reason === "comanda_closed"
            ? "Esta comanda já foi fechada."
            : "Não foi possível cancelar o item."
        );
        setIsSubmitting(false);
        return;
      }

      setReason("");
      setSupervisorPassword("");
      onSuccess();
      onOpenChange(false);
    } catch {
      setErrorMessage("Erro ao processar cancelamento. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar Item da Comanda</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Card com resumo do item */}
          <div className="p-3 bg-red-50/60 border border-red-200 rounded-[var(--radius-card)] space-y-1 text-xs text-red-950">
            <div className="flex justify-between font-bold text-sm">
              <span>{itemQuantity}x {itemProductName}</span>
              <span>{formatCentsToBRL(itemTotalPriceCents)}</span>
            </div>
            <p className="text-[11px] text-red-800">
              Esta ação removerá o item da comanda e gravará um registro no log de auditoria.
            </p>
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

          <div className="space-y-3">
            <div>
              <label htmlFor="reason" className="block text-xs font-semibold text-[var(--text-2)] mb-1">
                Justificativa do Cancelamento *
              </label>
              <textarea
                id="reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex.: Item lançado duplicado por erro do operador / Cliente desistiu antes de abrir..."
                className="w-full p-2.5 bg-white border border-[var(--border)] rounded text-xs outline-none focus:border-[var(--accent)]"
              />
            </div>

            {isAtendente && (
              <div>
                <label htmlFor="supervisorPassword" className="block text-xs font-semibold text-[var(--text-2)] mb-1">
                  Senha do Supervisor (Admin ou Gerente) *
                </label>
                <input
                  type="password"
                  id="supervisorPassword"
                  value={supervisorPassword}
                  onChange={(e) => setSupervisorPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-9 px-3 bg-white border border-[var(--border)] rounded text-xs outline-none focus:border-[var(--accent)]"
                />
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={reason.trim().length < 5 || (isAtendente && !supervisorPassword) || isSubmitting}
              onClick={() => void handleConfirmCancel()}
              className="bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              {isSubmitting ? "Cancelando..." : "Confirmar Cancelamento"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
