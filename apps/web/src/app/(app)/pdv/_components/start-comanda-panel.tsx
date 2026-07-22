"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CustomerSearchCombobox } from "./customer-search-combobox";
import { QuickCreateCustomerDialog } from "./quick-create-customer-dialog";
import { openComandaAction } from "../_actions/open-comanda.action";
import type { CustomerSearchResult } from "../_actions/search-customers.action";

export function StartComandaPanel() {
  const router = useRouter();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function openWithCustomer(customerId: string | null) {
    setIsOpening(true);
    setErrorMessage(null);
    const result = await openComandaAction(customerId);
    if (!result.success) {
      setErrorMessage(result.message);
      setIsOpening(false);
      return;
    }
    router.push(`/pdv/${result.comandaId}`);
  }

  function handleCustomerCreated(customer: { id: string }) {
    setDialogOpen(false);
    void openWithCustomer(customer.id);
  }

  return (
    <div className="max-w-md mx-auto space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-[var(--text-1)]">Nova comanda</h1>
        <p className="text-sm text-[var(--text-3)]">
          Busque o cliente, cadastre um novo ou siga como venda balcão.
        </p>
      </div>

      {errorMessage && (
        <div
          className="px-3 py-2.5 rounded-[var(--radius-control)] text-sm"
          style={{
            backgroundColor: "var(--danger-bg)",
            border: "1px solid var(--danger-border)",
            color: "var(--danger)",
          }}
        >
          {errorMessage}
        </div>
      )}

      <CustomerSearchCombobox
        onSelect={(customer: CustomerSearchResult) => void openWithCustomer(customer.id)}
        emptyStateSlot={
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="ml-1 text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium"
          >
            Cadastrar novo cliente
          </button>
        }
      />

      <div className="flex items-center gap-3 text-xs text-[var(--text-3)]">
        <div className="h-px flex-1 bg-[var(--border)]" />
        ou
        <div className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button type="button" variant="outline" onClick={() => setDialogOpen(true)} disabled={isOpening}>
          Cadastrar cliente novo
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void openWithCustomer(null)}
          disabled={isOpening}
        >
          Venda balcão (sem identificação)
        </Button>
      </div>

      <QuickCreateCustomerDialog
        open={isDialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCustomerCreated}
      />
    </div>
  );
}
