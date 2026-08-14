"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { cancelItemAction } from "../_actions/cancel-item.action";

export function CancelItemDialog({
  open,
  onOpenChange,
  comandaId,
  comandaItemId,
  itemName,
  isSupervisor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comandaId: string;
  comandaItemId: string;
  itemName: string;
  isSupervisor: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [supervisorPassword, setSupervisorPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    if (!reason.trim() || reason.trim().length < 5) {
      setErrorMessage("A justificativa deve ter no mínimo 5 caracteres.");
      return;
    }

    if (!isSupervisor && !supervisorPassword) {
      setErrorMessage("Informe a senha do supervisor para autorizar o cancelamento.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await cancelItemAction(
      comandaId,
      comandaItemId,
      reason.trim(),
      !isSupervisor ? supervisorPassword : undefined
    );

    if (!result.success) {
      if (result.reason === "invalid_supervisor_password") {
        setErrorMessage("Senha de supervisor incorreta ou sem permissão.");
      } else if (result.reason === "unauthorized") {
        setErrorMessage("Senha de supervisor exigida para este operador.");
      } else {
        setErrorMessage("Não foi possível cancelar o item.");
      }
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
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="size-5 shrink-0" />
            Cancelar Item da Comanda
          </DialogTitle>
          <DialogDescription>
            Exclusão de item lançado em comanda. Esta operação é gravada no histórico de auditoria.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleConfirm} className="space-y-4 py-2">
          {errorMessage && (
            <div className="p-3 rounded-[var(--radius-control)] text-xs font-medium bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)]">
              {errorMessage}
            </div>
          )}

          <div className="p-3 rounded bg-red-50 border border-red-200 text-xs text-red-900">
            <span className="text-[10px] font-bold uppercase tracking-wider block text-red-700">
              Item a ser cancelado:
            </span>
            <strong className="text-sm font-bold text-red-950 block mt-0.5">{itemName}</strong>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-2)] block">
              Justificativa / Motivo do Cancelamento (obrigatório)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Lançamento duplicado por engano / Cliente desistiu do produto"
              required
              rows={3}
              className="w-full p-2.5 text-xs text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-control)] outline-none focus:border-red-500 resize-none"
            />
          </div>

          {!isSupervisor && (
            <div className="p-3 rounded bg-amber-50 border border-amber-200 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                <ShieldAlert className="size-4 shrink-0" />
                Autorização de Supervisor Requerida
              </div>
              <p className="text-[11px] text-amber-700">
                Seu perfil de atendente exige a senha de um Administrador ou Gerente para autorizar esta exclusão.
              </p>
              <input
                type="password"
                value={supervisorPassword}
                onChange={(e) => setSupervisorPassword(e.target.value)}
                placeholder="Digite a senha do supervisor"
                required
                className="w-full h-9 px-3 text-xs bg-white border border-amber-300 rounded outline-none focus:border-amber-600"
              />
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Manter Item
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
            >
              {isSubmitting ? "Cancelando…" : "Confirmar Cancelamento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
