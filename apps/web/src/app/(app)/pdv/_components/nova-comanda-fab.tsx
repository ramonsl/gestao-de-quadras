"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CustomerSearchCombobox } from "./customer-search-combobox";
import { QuickCreateCustomerDialog, type QuickCreatedCustomer } from "./quick-create-customer-dialog";
import { openComandaAction } from "../_actions/open-comanda.action";
import type { CustomerSearchResult } from "../_actions/search-customers.action";

export function NovaComandaFab() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [existingComandaId, setExistingComandaId] = useState<string | null>(null);

  async function handleOpenComanda(customerId: string | null) {
    setIsOpening(true);
    setErrorMessage(null);
    setExistingComandaId(null);

    try {
      const result = await openComandaAction(customerId);
      if (!result.success) {
        if (result.reason === "already_has_open_comanda") {
          setExistingComandaId(result.existingComandaId);
        }
        setErrorMessage(result.message);
        setIsOpening(false);
        return;
      }
      setIsOpen(false);
      router.push(`/pdv/${result.comandaId}`);
    } catch {
      setErrorMessage("Não foi possível abrir a comanda. Tente novamente.");
      setIsOpening(false);
    }
  }

  function handleCustomerCreated(customer: QuickCreatedCustomer) {
    setIsQuickCreateOpen(false);
    void handleOpenComanda(customer.id);
  }

  return (
    <>
      {/* FAB Flutuante de Criar Comanda */}
      <button
        type="button"
        onClick={() => {
          setErrorMessage(null);
          setExistingComandaId(null);
          setIsOpen(true);
        }}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 h-14 px-5 rounded-full text-white font-semibold shadow-lg transition-transform hover:scale-105 active:scale-95"
        style={{
          backgroundColor: "var(--accent)",
          boxShadow: "0 4px 14px rgba(0, 0, 0, 0.25)",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        <span>Nova Comanda</span>
      </button>

      {/* Modal de Escolha */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Abrir Nova Comanda</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {errorMessage && (
              <div
                className="p-3 rounded-[var(--radius-control)] text-sm space-y-2"
                style={{
                  backgroundColor: "var(--danger-bg)",
                  border: "1px solid var(--danger-border)",
                  color: "var(--danger)",
                }}
              >
                <p>{errorMessage}</p>
                {existingComandaId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full mt-1 border-[var(--danger-border)] text-[var(--danger)] hover:bg-white"
                    onClick={() => {
                      setIsOpen(false);
                      router.push(`/pdv/${existingComandaId}`);
                    }}
                  >
                    Ir para a comanda existente
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-[var(--text-3)]">
                Buscar Cliente Cadastrado
              </label>
              <CustomerSearchCombobox
                onSelect={(customer: CustomerSearchResult) => void handleOpenComanda(customer.id)}
                emptyStateSlot={
                  <button
                    type="button"
                    onClick={() => setIsQuickCreateOpen(true)}
                    className="ml-1 text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium"
                  >
                    Cadastrar novo cliente
                  </button>
                }
              />
            </div>

            <div className="flex items-center gap-3 text-xs text-[var(--text-3)] my-2">
              <div className="h-px flex-1 bg-[var(--border)]" />
              ou
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsQuickCreateOpen(true)}
                disabled={isOpening}
              >
                Cadastrar cliente novo
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleOpenComanda(null)}
                disabled={isOpening}
              >
                Venda balcão (sem id)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <QuickCreateCustomerDialog
        open={isQuickCreateOpen}
        onOpenChange={setIsQuickCreateOpen}
        onCreated={handleCustomerCreated}
      />
    </>
  );
}
