"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { WhatsappInput } from "@/components/ui/whatsapp-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  quickCreateCustomerAction,
  type QuickCreateCustomerState,
} from "../_actions/quick-create-customer.action";
import {
  lookupGlobalCustomerAction,
  type GlobalCustomerPreview,
} from "../_actions/lookup-global-customer.action";

const inputCls =
  "w-full h-9 px-3 text-sm text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-input)] outline-none transition-[border-color] duration-[180ms] placeholder:text-[var(--text-3)] focus:border-[var(--accent)]";

const initialState: QuickCreateCustomerState = { status: "idle" };

export interface QuickCreatedCustomer {
  id: string;
  name: string;
  whatsapp: string;
}

interface QuickCreateCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (customer: QuickCreatedCustomer) => void;
}

export function QuickCreateCustomerDialog({
  open,
  onOpenChange,
  onCreated,
}: QuickCreateCustomerDialogProps) {
  const [state, formAction, pending] = useActionState(quickCreateCustomerAction, initialState);
  const [optInLgpd, setOptInLgpd] = useState(true);
  const [whatsappE164, setWhatsappE164] = useState("");
  const [globalPreview, setGlobalPreview] = useState<GlobalCustomerPreview | null>(null);
  const debouncedWhatsapp = useDebouncedValue(whatsappE164, 400);

  useEffect(() => {
    if (state.status === "success") {
      onCreated({ id: state.customerId, name: state.customerName, whatsapp: state.customerWhatsapp });
    }
  }, [state, onCreated]);

  // Prévia dos dados globais (CAD-01/PDV-02): mostra ANTES de submeter, para o
  // operador ver que os dados do global vão prevalecer sobre o texto digitado.
  useEffect(() => {
    if (debouncedWhatsapp.length < 13) {
      setGlobalPreview(null);
      return;
    }
    let cancelled = false;
    void lookupGlobalCustomerAction(debouncedWhatsapp).then((preview) => {
      if (!cancelled) setGlobalPreview(preview);
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedWhatsapp]);

  useEffect(() => {
    if (!open) {
      setGlobalPreview(null);
      setWhatsappE164("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar cliente</DialogTitle>
          <DialogDescription>
            Cadastro rápido — só Nome e WhatsApp. Complete e-mail e data de nascimento depois na tela de
            Clientes.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {state.status === "error" && state.message && (
            <div
              className="px-3 py-2.5 rounded-[var(--radius-control)] text-sm"
              style={{
                backgroundColor: "var(--danger-bg)",
                border: "1px solid var(--danger-border)",
                color: "var(--danger)",
              }}
            >
              {state.message}
            </div>
          )}

          <div>
            <Label htmlFor="quick-name" className="block text-xs font-semibold text-[var(--text-2)] mb-1.5">
              Nome *
            </Label>
            <input id="quick-name" name="name" type="text" required maxLength={100} className={inputCls} />
            {state.status === "error" && state.fieldErrors?.name && (
              <p className="text-xs text-[var(--danger)] mt-1">{state.fieldErrors.name[0]}</p>
            )}
          </div>

          <div>
            <Label htmlFor="quick-whatsapp" className="block text-xs font-semibold text-[var(--text-2)] mb-1.5">
              WhatsApp *
            </Label>
            <WhatsappInput id="quick-whatsapp" name="whatsapp" onValueChange={setWhatsappE164} />
            {state.status === "error" && state.fieldErrors?.whatsapp && (
              <p className="text-xs text-[var(--danger)] mt-1">{state.fieldErrors.whatsapp[0]}</p>
            )}
            {globalPreview?.found && (
              <p
                className="text-xs mt-1.5 px-2.5 py-1.5 rounded-[var(--radius-control)]"
                style={{ backgroundColor: "var(--accent-tint)", color: "var(--accent)" }}
              >
                Já existe um cadastro global para este WhatsApp: <strong>{globalPreview.name}</strong>
                {globalPreview.email ? ` · ${globalPreview.email}` : ""}. Esses dados serão usados no
                lugar do que foi digitado acima.
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--text-2)]">
            <input
              type="checkbox"
              name="optInLgpd"
              checked={optInLgpd}
              onChange={(e) => setOptInLgpd(e.target.checked)}
              className="h-4 w-4 rounded-[var(--radius-control)]"
            />
            Cliente autoriza receber mensagens via WhatsApp
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Cadastrando…" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
