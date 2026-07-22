"use client";

import { useState } from "react";
import type { ComandaWithItems, ComandaItemView } from "@gestao-de-quadras/core/pdv";
import type { Product } from "@gestao-de-quadras/db/schema";
import { formatCentsToBRL } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProductGrid } from "./product-grid";
import { PrintTicketToggle } from "./print-ticket-toggle";
import { CustomerSearchCombobox } from "../../_components/customer-search-combobox";
import {
  QuickCreateCustomerDialog,
  type QuickCreatedCustomer,
} from "../../_components/quick-create-customer-dialog";
import type { CustomerSearchResult } from "../../_actions/search-customers.action";
import { addItemAction } from "../_actions/add-item.action";
import { linkCustomerAction } from "../_actions/link-customer.action";

interface ComandaWorkspaceProps {
  comanda: ComandaWithItems;
  products: Product[];
}

export function ComandaWorkspace({ comanda: initialComanda, products }: ComandaWorkspaceProps) {
  const comandaId = initialComanda.id;
  const [customerId, setCustomerId] = useState(initialComanda.customerId);
  const [customerName, setCustomerName] = useState(initialComanda.customerName);
  const [customerWhatsapp, setCustomerWhatsapp] = useState(initialComanda.customerWhatsapp);
  const [items, setItems] = useState<ComandaItemView[]>(initialComanda.items);
  const [totalCents, setTotalCents] = useState(initialComanda.totalCents);
  const [isLinkDialogOpen, setLinkDialogOpen] = useState(false);
  const [isQuickCreateOpen, setQuickCreateOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleAddItem(productId: string, quantity: number) {
    setIsAdding(true);
    setErrorMessage(null);
    const result = await addItemAction(comandaId, productId, quantity);
    setIsAdding(false);
    if (!result.success) {
      setErrorMessage(
        result.reason === "product_not_found"
          ? "Produto não encontrado."
          : "Não foi possível lançar o item — a comanda pode estar fechada."
      );
      return;
    }
    setItems((prev) => [...prev, result.item]);
    setTotalCents(result.comandaTotalCents);
  }

  async function handleLinkCustomer(customer: CustomerSearchResult) {
    const result = await linkCustomerAction(comandaId, customer.id);
    if (!result.success) {
      setErrorMessage("Não foi possível vincular o cliente — a comanda já pode estar identificada.");
      return;
    }
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerWhatsapp(customer.whatsapp);
    setLinkDialogOpen(false);
  }

  function handleCustomerCreatedForLink(customer: QuickCreatedCustomer) {
    setQuickCreateOpen(false);
    void handleLinkCustomer(customer);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-1)]">{customerName ?? "Venda Balcão"}</h1>
          {customerWhatsapp && <p className="text-sm text-[var(--text-3)]">{customerWhatsapp}</p>}
        </div>
        {!customerId && (
          <Button type="button" variant="outline" onClick={() => setLinkDialogOpen(true)}>
            Vincular cliente
          </Button>
        )}
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

      <PrintTicketToggle />

      <ProductGrid products={products} onAdd={(id, qty) => void handleAddItem(id, qty)} disabled={isAdding} />

      <div className="border border-[var(--border)] rounded-[var(--radius-card)] bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-sunken)] text-[var(--text-3)] text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">Item</th>
              <th className="text-right px-3 py-2">Qtd</th>
              <th className="text-right px-3 py-2">Unit.</th>
              <th className="text-right px-3 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[var(--text-3)]">
                  Nenhum item lançado ainda.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 text-[var(--text-1)]">{item.productNameAtSale}</td>
                  <td className="px-3 py-2 text-right text-[var(--text-2)]">{item.quantity}</td>
                  <td className="px-3 py-2 text-right text-[var(--text-2)]">
                    {formatCentsToBRL(item.unitPriceCentsAtSale)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-[var(--text-1)]">
                    {formatCentsToBRL(item.lineTotalCents)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-3 py-3 border-t border-[var(--border)] bg-[var(--bg-sunken)]">
          <span className="text-sm font-medium text-[var(--text-2)]">Total parcial</span>
          <span className="text-base font-semibold text-[var(--text-1)]">{formatCentsToBRL(totalCents)}</span>
        </div>
      </div>

      <Dialog open={isLinkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular cliente</DialogTitle>
          </DialogHeader>
          <CustomerSearchCombobox
            onSelect={(customer) => void handleLinkCustomer(customer)}
            emptyStateSlot={
              <button
                type="button"
                onClick={() => {
                  setLinkDialogOpen(false);
                  setQuickCreateOpen(true);
                }}
                className="ml-1 text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium"
              >
                Cadastrar novo cliente
              </button>
            }
          />
        </DialogContent>
      </Dialog>

      <QuickCreateCustomerDialog
        open={isQuickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        onCreated={handleCustomerCreatedForLink}
      />
    </div>
  );
}
