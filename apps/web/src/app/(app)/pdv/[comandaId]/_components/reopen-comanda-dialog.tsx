"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RotateCcw, ShieldAlert } from "lucide-react";
import { reopenComandaAction } from "../_actions/reopen-comanda.action";

export function ReopenComandaDialog({
  open,
  onOpenChange,
  comandaId,
  isSupervisor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comandaId: string;
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
      setErrorMessage("Informe a senha do supervisor para autorizar a reabertura.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await reopenComandaAction(
      comandaId,
      reason.trim(),
      !isSupervisor ? supervisorPassword : undefined
    );

    if (!result.success) {
      if (result.reason === "invalid_supervisor_password") {
        setErrorMessage("Senha de supervisor incorreta ou sem permissão.");
      } else if (result.reason === "unauthorized") {
        setErrorMessage("Senha de supervisor exigida para este operador.");
      } else {
        setErrorMessage("Não foi possível estornar/reabrir a comanda.");
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
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <RotateCcw className="size-5 shrink-0" />
            Estornar / Reabrir Comanda
          </DialogTitle>
          <DialogDescription>
            A comanda fechada retornará ao status Aberto para correções. Esta operação é gravada na auditoria.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleConfirm} className="space-y-4 py-2">
          {errorMessage && (
            <div className="p-3 rounded-[var(--radius-control)] text-xs font-medium bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)]">
              {errorMessage}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-2)] block">
              Justificativa / Motivo da Reabertura (obrigatório)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Correção de forma de pagamento / Inclusão de item esquecido"
              required
              rows={3}
              className="w-full p-2.5 text-xs text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-control)] outline-none focus:border-amber-500 resize-none"
            />
          </div>

          {!isSupervisor && (
            <div className="p-3 rounded bg-amber-50 border border-amber-200 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                <ShieldAlert className="size-4 shrink-0" />
                Autorização de Supervisor Requerida
              </div>
              <p className="text-[11px] text-amber-700">
                Seu perfil de atendente exige a senha de um Administrador ou Gerente para autorizar esta reabertura.
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
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
            >
              {isSubmitting ? "Reabrindo…" : "Confirmar Reabertura"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
