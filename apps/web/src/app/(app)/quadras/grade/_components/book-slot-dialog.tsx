"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, UserPlus, ShoppingBag } from "lucide-react";
import { formatCentsToBRL } from "@/lib/currency";
import { CustomerSearchCombobox } from "../../../pdv/_components/customer-search-combobox";
import type { CustomerSearchResult } from "../../../pdv/_actions/search-customers.action";
import { createBookingAction } from "../_actions/create-booking.action";
import { addBookingToComandaAction } from "../_actions/add-booking-to-comanda.action";
import { splitBookingAction, type SplitParticipantItem } from "../_actions/split-booking.action";

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

type SplitDraftParticipant =
  | { id: string; kind: "existing"; comandaId: string; label: string }
  | { id: string; kind: "new"; customerId: string | null; customerName: string };

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

  // Lista dinâmica de participantes no rateio
  const [splitParticipants, setSplitParticipants] = useState<SplitDraftParticipant[]>(() => {
    if (comandaOptions.length >= 2) {
      return [
        { id: "1", kind: "existing", comandaId: comandaOptions[0].id, label: comandaOptions[0].label },
        { id: "2", kind: "existing", comandaId: comandaOptions[1].id, label: comandaOptions[1].label },
      ];
    }
    if (comandaOptions.length === 1) {
      return [
        { id: "1", kind: "existing", comandaId: comandaOptions[0].id, label: comandaOptions[0].label },
        { id: "2", kind: "new", customerId: null, customerName: "Venda Balcão (Nova Comanda)" },
      ];
    }
    return [
      { id: "1", kind: "new", customerId: null, customerName: "Jogador 1 (Nova Comanda)" },
      { id: "2", kind: "new", customerId: null, customerName: "Jogador 2 (Nova Comanda)" },
    ];
  });

  const [isAddingNewCustomerToSplit, setIsAddingNewCustomerToSplit] = useState(false);
  const [isMonthlyContract, setIsMonthlyContract] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const addExistingComandaToSplit = (opt: ComandaOption) => {
    // Evita duplicar a mesma comanda aberta
    if (splitParticipants.some((p) => p.kind === "existing" && p.comandaId === opt.id)) return;
    setSplitParticipants((prev) => [
      ...prev,
      { id: String(Date.now()), kind: "existing", comandaId: opt.id, label: opt.label },
    ]);
  };

  const addNewCustomerToSplit = (c: CustomerSearchResult | null) => {
    setSplitParticipants((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        kind: "new",
        customerId: c?.id ?? null,
        customerName: c ? c.name : `Balcão (${prev.length + 1})`,
      },
    ]);
    setIsAddingNewCustomerToSplit(false);
  };

  const removeSplitParticipant = (id: string) => {
    if (splitParticipants.length <= 2) return; // Mínimo 2 participantes
    setSplitParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  async function handleConfirm() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    const base = {
      courtId: slot.courtId,
      date,
      startTimeHHMM: slot.startTimeHHMM,
      isMonthly: isMonthlyContract,
    };

    let result: { success: boolean; error?: string };
    if (mode === "new") {
      result = await createBookingAction({ ...base, customerId: customer?.id ?? null });
    } else if (mode === "existing") {
      result = await addBookingToComandaAction({ ...base, comandaId });
    } else {
      const payloadParticipants: SplitParticipantItem[] = splitParticipants.map((p) =>
        p.kind === "existing"
          ? { type: "existing", comandaId: p.comandaId }
          : { type: "new", customerId: p.customerId, customerName: p.customerName }
      );
      result = await splitBookingAction({ ...base, participants: payloadParticipants });
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
      : splitParticipants.length >= 2;

  const splitCount = splitParticipants.length;
  const shareCents = splitCount >= 2 ? Math.floor(slot.priceInCents / splitCount) : 0;
  const durationLabel = slot.slotCount === 1 ? "30 min" : `${(slot.slotCount * 0.5).toString().replace(".", ",")}h`;

  // Comandas abertas ainda não adicionadas ao rateio
  const availableOpenComandas = comandaOptions.filter(
    (opt) => !splitParticipants.some((p) => p.kind === "existing" && p.comandaId === opt.id)
  );

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
          {/* Alternador de modo */}
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
              className={`py-2 px-1 text-[11px] font-semibold rounded border transition-all ${
                mode === "split"
                  ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm"
                  : "bg-white text-[var(--text-2)] border-[var(--border)] hover:border-[var(--accent)]"
              }`}
            >
              Ratear ({splitCount})
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

          {/* Mode SPLIT — Suporta N comandas (existentes ou novas) */}
          {mode === "split" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[var(--text-2)] block">
                  Jogadores / Comandas no Rateio ({splitCount})
                </label>
                <span className="text-[11px] font-bold text-[var(--accent)]">
                  {formatCentsToBRL(shareCents)} / jogador
                </span>
              </div>

              {/* Lista dos participantes configurados */}
              <div className="space-y-1.5 max-h-44 overflow-y-auto border border-[var(--border)] p-2 rounded-[var(--radius-control)] bg-[var(--bg-sunken)]">
                {splitParticipants.map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2 rounded bg-white border border-[var(--border-soft)] text-xs shadow-2xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-[var(--accent-tint-soft)] text-[var(--accent)] font-bold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-[var(--text-1)] truncate">
                        {p.kind === "existing" ? p.label : p.customerName}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-[var(--text-3)] shrink-0 font-medium">
                        {p.kind === "existing" ? "Comanda Aberta" : "Nova Comanda"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-[var(--text-1)] tabular-nums">
                        {formatCentsToBRL(shareCents)}
                      </span>
                      {splitParticipants.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeSplitParticipant(p.id)}
                          className="text-gray-400 hover:text-[var(--danger)] p-1 rounded transition-colors"
                          title="Remover participante"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Botões para adicionar participantes (Nova Comanda ou Comanda Aberta) */}
              <div className="space-y-2 pt-1">
                {isAddingNewCustomerToSplit ? (
                  <div className="p-2.5 rounded border border-[var(--accent-tint)] bg-[var(--accent-tint-soft)] space-y-2">
                    <p className="text-xs font-bold text-[var(--accent-hover)] flex items-center gap-1">
                      <UserPlus className="size-3.5" /> Adicionar Novo Jogador (Abrir Nova Comanda)
                    </p>
                    <CustomerSearchCombobox
                      onSelect={(c) => addNewCustomerToSplit(c)}
                      emptyStateSlot={
                        <button
                          type="button"
                          onClick={() => addNewCustomerToSplit(null)}
                          className="w-full text-left text-xs text-[var(--accent)] font-semibold p-1 hover:underline"
                        >
                          + Criar como Comanda de Balcão sem nome
                        </button>
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setIsAddingNewCustomerToSplit(false)}
                      className="text-[11px] text-[var(--text-3)] hover:underline"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingNewCustomerToSplit(true)}
                      className="flex-1 py-1.5 px-2.5 rounded border border-dashed border-[var(--accent)] text-[11px] font-semibold text-[var(--accent)] bg-white hover:bg-[var(--accent-tint-soft)] transition-colors flex items-center justify-center gap-1.5"
                    >
                      <UserPlus className="size-3.5" /> + Nova Comanda / Cliente
                    </button>

                    {availableOpenComandas.length > 0 && (
                      <select
                        onChange={(e) => {
                          const opt = availableOpenComandas.find((c) => c.id === e.target.value);
                          if (opt) addExistingComandaToSplit(opt);
                          e.target.value = "";
                        }}
                        defaultValue=""
                        className="py-1.5 px-2 text-[11px] font-semibold bg-white border border-[var(--border)] rounded cursor-pointer outline-none focus:border-[var(--accent)]"
                      >
                        <option value="" disabled>
                          + Comanda Aberta...
                        </option>
                        {availableOpenComandas.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label} ({formatCentsToBRL(c.totalCents)})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

              {/* Resumo do Rateio */}
              <div className="p-2.5 rounded bg-[var(--accent-tint-soft)] border border-[var(--accent-tint)] text-xs text-[var(--text-1)] flex items-center justify-between">
                <span>
                  Divisão de {formatCentsToBRL(slot.priceInCents)} entre {splitCount} jogadores:
                </span>
                <span className="font-extrabold text-[var(--accent-hover)] text-sm">
                  {formatCentsToBRL(shareCents)} / comanda
                </span>
              </div>
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
