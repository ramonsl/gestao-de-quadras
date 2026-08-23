"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCentsToBRL } from "@/lib/currency";
import type { ComandaItemView } from "@gestao-de-quadras/core/pdv";
import type { OpenComandaListItem } from "@gestao-de-quadras/core/pdv";
import { listOpenComandasAction } from "../_actions/list-open-comandas.action";
import { transferItemsAction } from "../_actions/transfer-items.action";
import { ArrowRightLeft, Check, Search, User, ShoppingCart } from "lucide-react";

// ── Etapas do fluxo ──────────────────────────────────────────────
type Step = "select-items" | "select-destination" | "confirm";

// ── Mensagens de erro traduzidas ─────────────────────────────────
const ERROR_MESSAGES: Record<string, string> = {
  same_comanda: "A comanda de destino não pode ser a mesma da origem.",
  source_comanda_not_found: "Comanda de origem não encontrada.",
  source_comanda_closed: "A comanda de origem já foi fechada.",
  destination_comanda_not_found: "Comanda de destino não encontrada.",
  destination_comanda_closed: "A comanda de destino já foi fechada.",
  item_not_found: "Um dos itens selecionados não pertence mais à comanda de origem.",
  destination_requires_customer:
    "Pacotes de aulas exigem que a comanda de destino tenha um cliente vinculado.",
};

interface TransferItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comandaId: string;
  items: ComandaItemView[];
}

export function TransferItemsDialog({
  open,
  onOpenChange,
  comandaId,
  items,
}: TransferItemsDialogProps) {
  const router = useRouter();

  // ── Estado do wizard ───────────────────────────────────────────
  const [step, setStep] = useState<Step>("select-items");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [destinationComandaId, setDestinationComandaId] = useState<string | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Busca de comandas destino ──────────────────────────────────
  const [openComandas, setOpenComandas] = useState<OpenComandaListItem[]>([]);
  const [isLoadingComandas, setIsLoadingComandas] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  // Reset ao abrir/fechar
  useEffect(() => {
    if (open) {
      setStep("select-items");
      setSelectedItemIds(new Set());
      setDestinationComandaId(null);
      setJustificativa("");
      setErrorMessage(null);
      setSearchFilter("");
    }
  }, [open]);

  // Busca comandas abertas ao entrar na etapa de destino
  useEffect(() => {
    if (step === "select-destination") {
      setIsLoadingComandas(true);
      void listOpenComandasAction(comandaId)
        .then(setOpenComandas)
        .finally(() => setIsLoadingComandas(false));
    }
  }, [step, comandaId]);

  // ── Helpers ────────────────────────────────────────────────────
  function toggleItem(itemId: string) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function toggleAll() {
    if (selectedItemIds.size === items.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(items.map((i) => i.id)));
    }
  }

  const selectedItems = items.filter((i) => selectedItemIds.has(i.id));
  const selectedTotalCents = selectedItems.reduce((sum, i) => sum + i.lineTotalCents, 0);

  const filteredComandas = openComandas.filter((c) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    const name = (c.customerName ?? "venda balcão").toLowerCase();
    const idSlice = c.id.slice(0, 8).toLowerCase();
    return name.includes(q) || idSlice.includes(q);
  });

  const destinationComanda = openComandas.find((c) => c.id === destinationComandaId);

  // ── Submit ─────────────────────────────────────────────────────
  async function handleConfirm() {
    if (!destinationComandaId || selectedItemIds.size === 0) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await transferItemsAction(
        comandaId,
        destinationComandaId,
        Array.from(selectedItemIds),
        justificativa.trim() || undefined
      );

      if (!result.success) {
        setErrorMessage(ERROR_MESSAGES[result.reason] ?? "Erro ao transferir itens.");
        setIsSubmitting(false);
        return;
      }

      router.refresh();
      onOpenChange(false);
    } catch {
      setErrorMessage("Erro inesperado ao transferir itens. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="size-5 shrink-0 text-[var(--accent)]" />
            Transferir Itens para Outra Comanda
          </DialogTitle>
          <DialogDescription>
            {step === "select-items" && "Selecione os itens que deseja transferir."}
            {step === "select-destination" && "Escolha a comanda de destino."}
            {step === "confirm" && "Revise e confirme a transferência."}
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="px-3 py-2.5 rounded-[var(--radius-control)] text-xs font-medium bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)]">
            {errorMessage}
          </div>
        )}

        {/* ── ETAPA 1: Selecionar itens ────────────────────────── */}
        {step === "select-items" && (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs font-semibold text-[var(--accent)] hover:underline"
              >
                {selectedItemIds.size === items.length ? "Desmarcar todos" : "Selecionar todos"}
              </button>
              <span className="text-xs text-[var(--text-3)]">
                {selectedItemIds.size} de {items.length} selecionado{selectedItemIds.size !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[40vh] pr-1">
              {items.map((item) => {
                const checked = selectedItemIds.has(item.id);
                return (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-[var(--radius-control)] border cursor-pointer transition-colors ${
                      checked
                        ? "border-[var(--accent)] bg-[var(--accent)]/5"
                        : "border-[var(--border)] bg-white hover:bg-[var(--bg-sunken)]"
                    }`}
                  >
                    <span
                      className={`flex items-center justify-center w-5 h-5 rounded border-2 shrink-0 transition-colors ${
                        checked
                          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                          : "border-[var(--border)] bg-white"
                      }`}
                    >
                      {checked && <Check className="w-3 h-3" />}
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggleItem(item.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-1)] truncate">
                        {item.productNameAtSale}
                      </p>
                      <p className="text-xs text-[var(--text-3)]">
                        {item.quantity}× {formatCentsToBRL(item.unitPriceCentsAtSale)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-[var(--text-1)] whitespace-nowrap">
                      {formatCentsToBRL(item.lineTotalCents)}
                    </span>
                  </label>
                );
              })}
            </div>

            {selectedItemIds.size > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                <span className="text-xs font-semibold text-[var(--text-2)]">
                  Total selecionado:
                </span>
                <span className="text-sm font-bold text-[var(--text-1)]">
                  {formatCentsToBRL(selectedTotalCents)}
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={selectedItemIds.size === 0}
                onClick={() => {
                  setErrorMessage(null);
                  setStep("select-destination");
                }}
                className="text-white font-semibold text-xs"
                style={{ backgroundColor: "var(--accent)" }}
              >
                Próximo: Escolher Destino
              </Button>
            </div>
          </div>
        )}

        {/* ── ETAPA 2: Escolher comanda destino ────────────────── */}
        {step === "select-destination" && (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-3)]" />
              <input
                type="text"
                placeholder="Buscar por nome do cliente ou nº da comanda…"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-[var(--border)] rounded-[var(--radius-control)] outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[40vh] pr-1">
              {isLoadingComandas ? (
                <div className="py-10 text-center text-xs text-[var(--text-3)]">
                  Carregando comandas…
                </div>
              ) : filteredComandas.length === 0 ? (
                <div className="py-10 text-center text-xs text-[var(--text-3)]">
                  {openComandas.length === 0
                    ? "Nenhuma outra comanda aberta no momento."
                    : "Nenhuma comanda encontrada para o filtro."}
                </div>
              ) : (
                filteredComandas.map((c) => {
                  const isSelected = destinationComandaId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setDestinationComandaId(c.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-[var(--radius-control)] border text-left transition-colors ${
                        isSelected
                          ? "border-[var(--accent)] bg-[var(--accent)]/5"
                          : "border-[var(--border)] bg-white hover:bg-[var(--bg-sunken)]"
                      }`}
                    >
                      <span
                        className={`flex items-center justify-center w-5 h-5 rounded-full border-2 shrink-0 transition-colors ${
                          isSelected
                            ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                            : "border-[var(--border)] bg-white"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </span>

                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--bg-sunken)] text-[var(--text-3)] shrink-0">
                          {c.customerName ? (
                            <User className="w-4 h-4" />
                          ) : (
                            <ShoppingCart className="w-4 h-4" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--text-1)] truncate">
                            {c.customerName ?? "Venda Balcão"}
                          </p>
                          <p className="text-xs text-[var(--text-3)]">
                            #{c.id.slice(0, 8)} · {c.itemCount} {c.itemCount === 1 ? "item" : "itens"} · {formatCentsToBRL(c.totalCents)}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setErrorMessage(null);
                  setStep("select-items");
                }}
              >
                Voltar
              </Button>
              <Button
                type="button"
                disabled={!destinationComandaId}
                onClick={() => {
                  setErrorMessage(null);
                  setStep("confirm");
                }}
                className="text-white font-semibold text-xs"
                style={{ backgroundColor: "var(--accent)" }}
              >
                Próximo: Revisar
              </Button>
            </div>
          </div>
        )}

        {/* ── ETAPA 3: Confirmação ─────────────────────────────── */}
        {step === "confirm" && (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Resumo da transferência */}
            <div className="p-3 rounded-[var(--radius-control)] bg-[var(--bg-sunken)] border border-[var(--border)] space-y-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)] block">
                  Itens a transferir ({selectedItems.length})
                </span>
                <div className="mt-1 space-y-0.5">
                  {selectedItems.map((item) => (
                    <div key={item.id} className="flex justify-between text-xs text-[var(--text-1)]">
                      <span className="truncate mr-2">
                        {item.productNameAtSale} ×{item.quantity}
                      </span>
                      <span className="font-medium whitespace-nowrap">
                        {formatCentsToBRL(item.lineTotalCents)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 pt-1.5 border-t border-[var(--border)] flex justify-between text-xs">
                  <span className="font-semibold text-[var(--text-2)]">Total:</span>
                  <span className="font-bold text-[var(--text-1)]">
                    {formatCentsToBRL(selectedTotalCents)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <ArrowRightLeft className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <div>
                  <span className="text-[var(--text-3)]">Destino: </span>
                  <span className="font-semibold text-[var(--text-1)]">
                    {destinationComanda?.customerName ?? "Venda Balcão"}
                  </span>
                  <span className="text-[var(--text-3)] ml-1">
                    (#{destinationComandaId?.slice(0, 8)})
                  </span>
                </div>
              </div>
            </div>

            {/* Justificativa opcional */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-2)] block">
                Justificativa (opcional)
              </label>
              <textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Ex: Itens lançados na comanda errada por engano"
                rows={2}
                className="w-full p-2.5 text-xs text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-control)] outline-none focus:border-[var(--accent)] resize-none"
              />
            </div>

            <div className="flex justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setErrorMessage(null);
                  setStep("select-destination");
                }}
              >
                Voltar
              </Button>
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleConfirm()}
                className="text-white font-bold text-xs"
                style={{ backgroundColor: "var(--accent)" }}
              >
                {isSubmitting ? "Transferindo…" : "Confirmar Transferência"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
