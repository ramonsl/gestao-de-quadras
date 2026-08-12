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
import { splitBookingAction } from "../_actions/split-booking.action";

export interface ComandaOption {
  id: string;
  label: string;
  totalCents: number;
}

export interface SelectedSlotRange {
  courtId: string;
  courtName: string;
  startTimeHHMM: string;
  endTimeHHMM: string;
  slotCount: number;
  priceInCents: number;
}

type Mode = "new" | "existing" | "split";

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
  slot: SelectedSlotRange;
  comandaOptions: ComandaOption[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("new");
  const [customer, setCustomer] = useState<CustomerSearchResult | null>(null);
  const [comandaId, setComandaId] = useState<string>(comandaOptions[0]?.id ?? "");
  const [selectedSplitComandaIds, setSelectedSplitComandaIds] = useState<string[]>(
    comandaOptions.slice(0, 2).map((c) => c.id)
  );
  const [isMonthlyContract, setIsMonthlyContract] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toggleSplitComanda = (id: string) => {
    setSelectedSplitComandaIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  async function handleConfirm() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    const base = { courtId: slot.courtId, date, startTimeHHMM: slot.startTimeHHMM };

    let result: { success: boolean; error?: string };
    if (mode === "new") {
      result = await createBookingAction({ ...base, customerId: customer?.id ?? null });
    } else if (mode === "existing") {
      result = await addBookingToComandaAction({ ...base, comandaId });
    } else {
      result = await splitBookingAction({ ...base, comandaIds: selectedSplitComandaIds });
    }

    if (!result.success) {
      setErrorMessage(result.error ?? "Não foi possível marcar a locação.");
      setIsSubmitting(false);
      return;
    }

    router.refresh();
    onOpenChange(false);
  }

  const canConfirm =
    mode === "new"
      ? true
      : mode === "existing"
      ? comandaId !== ""
      : selectedSplitComandaIds.length >= 2;

  const splitCount = selectedSplitComandaIds.length;
  const shareCents = splitCount >= 2 ? Math.floor(slot.priceInCents / splitCount) : 0;
  const durationLabel = slot.slotCount === 1 ? "30 min" : `${(slot.slotCount * 0.5).toString().replace(".", ",")}h`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Marcar Locação
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--accent-tint-soft)] text-[var(--accent)]">
              {durationLabel} ({slot.slotCount} blocos)
            </span>
          </DialogTitle>
          <DialogDescription>
            <strong className="text-[var(--text-1)]">{slot.courtName}</strong> ·{" "}
            {slot.startTimeHHMM}–{slot.endTimeHHMM} ·{" "}
            <span className="font-bold text-[var(--text-1)]">{formatCentsToBRL(slot.priceInCents)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Alternador de caminho (AC3 + Rateio) */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`py-2 px-1 text-[11px] font-semibold rounded border transition-all ${
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
              className={`py-2 px-1 text-[11px] font-semibold rounded border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                mode === "existing"
                  ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm"
                  : "bg-white text-[var(--text-2)] border-[var(--border)] hover:border-[var(--accent)]"
              }`}
            >
              Comanda existente
            </button>
            <button
              type="button"
              onClick={() => setMode("split")}
              disabled={comandaOptions.length < 2}
              title={comandaOptions.length < 2 ? "Exige pelo menos 2 comandas abertas" : "Dividir entre N comandas"}
              className={`py-2 px-1 text-[11px] font-semibold rounded border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                mode === "split"
                  ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm"
                  : "bg-white text-[var(--text-2)] border-[var(--border)] hover:border-[var(--accent)]"
              }`}
            >
              Ratear ({comandaOptions.length})
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

          {mode === "new" && (
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
          )}

          {mode === "existing" && (
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

          {mode === "split" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[var(--text-2)] block">
                  Selecione as comandas participantes (qualquer quantidade)
                </label>
                <span className="text-[11px] font-semibold text-[var(--accent)]">
                  {splitCount} selecionada(s)
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-[var(--border)] p-2 rounded-[var(--radius-control)] bg-[var(--bg-sunken)]">
                {comandaOptions.map((c) => {
                  const checked = selectedSplitComandaIds.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-colors text-xs select-none ${
                        checked
                          ? "bg-white border-[var(--accent)] text-[var(--text-1)] shadow-2xs"
                          : "bg-white/60 border-[var(--border-soft)] text-[var(--text-2)] hover:border-[var(--border)]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSplitComanda(c.id)}
                          className="rounded text-[var(--accent)] focus:ring-[var(--accent)]"
                        />
                        <span className="font-semibold">{c.label}</span>
                      </div>
                      <span className="text-[11px] text-[var(--text-3)]">
                        {formatCentsToBRL(c.totalCents)}
                      </span>
                    </label>
                  );
                })}
              </div>

              {splitCount >= 2 ? (
                <div className="p-2.5 rounded bg-[var(--accent-tint-soft)] border border-[var(--accent-tint)] text-xs text-[var(--text-1)] flex items-center justify-between">
                  <span>
                    Rateio de {formatCentsToBRL(slot.priceInCents)} entre {splitCount} comandas:
                  </span>
                  <span className="font-bold text-[var(--accent-hover)]">
                    {formatCentsToBRL(shareCents)} / comanda
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-[var(--danger)]">
                  Selecione pelo menos 2 comandas para realizar o rateio.
                </p>
              )}
            </div>
          )}

          {/* Opção Mensalista (CAD-09) */}
          <div className="pt-2 border-t border-[var(--border-soft)]">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isMonthlyContract}
                onChange={(e) => setIsMonthlyContract(e.target.checked)}
                className="rounded text-[var(--accent)] focus:ring-[var(--accent)]"
              />
              <span className="text-xs font-semibold text-[var(--text-1)] flex items-center gap-1">
                🔄 Marcação de Mensalista
                <span className="text-[10px] font-normal text-[var(--text-3)]">
                  (Contrato recorrente — CAD-09)
                </span>
              </span>
            </label>
          </div>

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
