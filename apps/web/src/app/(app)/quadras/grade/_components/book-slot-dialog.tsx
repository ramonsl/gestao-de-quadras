"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCentsToBRL } from "@/lib/currency";
import { CustomerSearchCombobox } from "../../../pdv/_components/customer-search-combobox";
import type { CustomerSearchResult } from "../../../pdv/_actions/search-customers.action";
import { createBookingAction } from "../_actions/create-booking.action";
import { addBookingToComandaAction } from "../_actions/add-booking-to-comanda.action";

export interface ComandaOption {
  id: string;
  label: string;
  totalCents: number;
}

interface SlotInfo {
  courtId: string;
  courtName: string;
  startTimeHHMM: string;
  endTimeHHMM: string;
  priceInCents: number;
}

type Mode = "new" | "existing";

export function BookSlotDialog({
  open,
  onOpenChange,
  date,
  slot,
  comandaOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  slot: SlotInfo;
  comandaOptions: ComandaOption[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("new");
  const [customer, setCustomer] = useState<CustomerSearchResult | null>(null);
  const [comandaId, setComandaId] = useState<string>(comandaOptions[0]?.id ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleConfirm() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    const base = { courtId: slot.courtId, date, startTimeHHMM: slot.startTimeHHMM };
    const result =
      mode === "new"
        ? await createBookingAction({ ...base, customerId: customer?.id ?? null })
        : await addBookingToComandaAction({ ...base, comandaId });

    if (!result.success) {
      setErrorMessage(result.error ?? "Não foi possível marcar a locação.");
      setIsSubmitting(false);
      return;
    }

    router.refresh();
    onOpenChange(false);
  }

  const canConfirm = mode === "new" ? true : comandaId !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar Locação</DialogTitle>
          <DialogDescription>
            <strong className="text-[var(--text-1)]">{slot.courtName}</strong> ·{" "}
            {slot.startTimeHHMM}–{slot.endTimeHHMM} ·{" "}
            <span className="font-semibold text-[var(--text-1)]">{formatCentsToBRL(slot.priceInCents)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Alternador de caminho (AC3) */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`py-2 px-2 text-xs font-semibold rounded border transition-all ${
                mode === "new"
                  ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm"
                  : "bg-white text-[var(--text-2)] border-[var(--border)] hover:border-[var(--accent)]"
              }`}
            >
              Nova comanda
            </button>
            <button
              type="button"
              onClick={() => setMode("existing")}
              disabled={comandaOptions.length === 0}
              className={`py-2 px-2 text-xs font-semibold rounded border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                mode === "existing"
                  ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm"
                  : "bg-white text-[var(--text-2)] border-[var(--border)] hover:border-[var(--accent)]"
              }`}
            >
              Comanda existente
            </button>
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

          {mode === "new" ? (
            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--text-2)] block">
                Cliente (opcional)
              </label>
              {customer ? (
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-sunken)]">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-1)] truncate">{customer.name}</p>
                    <p className="text-[11px] text-[var(--text-3)]">{customer.whatsapp}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomer(null)}
                    className="text-[var(--accent)] hover:text-[var(--accent-hover)] text-xs font-medium shrink-0"
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                <CustomerSearchCombobox
                  onSelect={(c) => setCustomer(c)}
                  emptyStateSlot={
                    <p className="text-[11px] text-[var(--text-3)]">
                      Sem cliente, a locação abre uma comanda de balcão.
                    </p>
                  }
                />
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--text-2)] block">
                Comanda aberta
              </label>
              <select
                value={comandaId}
                onChange={(e) => setComandaId(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-white border border-[var(--border)] rounded-[var(--radius-control)] outline-none focus:border-[var(--accent)]"
              >
                {comandaOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} · {formatCentsToBRL(c.totalCents)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!canConfirm || isSubmitting}
              onClick={() => void handleConfirm()}
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold"
            >
              {isSubmitting ? "Marcando…" : "Confirmar Locação"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
