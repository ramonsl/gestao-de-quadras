"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComandaWithItems, ComandaItemView, ComandaPaymentView } from "@gestao-de-quadras/core/pdv";
import type { Product } from "@gestao-de-quadras/db/schema";
import { formatCentsToBRL } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PrintTicketToggle } from "./print-ticket-toggle";
import { ProductSelectorGrid } from "./product-selector-grid";
import { CloseComandaDialog } from "./close-comanda-dialog";
import { CancelItemDialog } from "./cancel-item-dialog";
import { ReopenComandaDialog } from "./reopen-comanda-dialog";
import { CustomerSearchCombobox } from "../../_components/customer-search-combobox";
import {
  QuickCreateCustomerDialog,
  type QuickCreatedCustomer,
} from "../../_components/quick-create-customer-dialog";
import type { CustomerSearchResult } from "../../_actions/search-customers.action";
import { linkCustomerAction } from "../_actions/link-customer.action";
import { addItemsAction } from "../_actions/add-items.action";
import { ElapsedTime } from "../../_components/elapsed-time";
import { SettleDebitDialog } from "../../_components/settle-debit-dialog";
import {
  getCustomerDebitSummaryAction,
  transferComandaToCustomerDebitAction,
} from "../../_actions/customer-debit.actions";

interface ComandaWorkspaceProps {
  comanda: ComandaWithItems;
  products: Product[];
  userRole?: string;
}

interface PendingItem {
  product: Product;
  quantity: number;
}

const PAYMENT_LABELS: Record<string, string> = {
  pix: "Pix",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  dinheiro: "Dinheiro",
  pontos: "Pontos / Cashback",
};

export function ComandaWorkspace({ comanda: initialComanda, products, userRole }: ComandaWorkspaceProps) {
  const router = useRouter();
  const comandaId = initialComanda.id;

  const [status, setStatus] = useState<"open" | "closed">(initialComanda.status);
  const [customerId, setCustomerId] = useState(initialComanda.customerId);
  const [customerName, setCustomerName] = useState(initialComanda.customerName);
  const [customerWhatsapp, setCustomerWhatsapp] = useState(initialComanda.customerWhatsapp);
  const [items, setItems] = useState<ComandaItemView[]>(initialComanda.items);
  const [payments, setPayments] = useState<ComandaPaymentView[]>(initialComanda.payments ?? []);
  const [totalCents, setTotalCents] = useState(initialComanda.totalCents);

  const [cancellingItem, setCancellingItem] = useState<ComandaItemView | null>(null);

  useEffect(() => {
    setStatus(initialComanda.status);
    setCustomerId(initialComanda.customerId);
    setCustomerName(initialComanda.customerName);
    setCustomerWhatsapp(initialComanda.customerWhatsapp);
    setItems(initialComanda.items);
    setPayments(initialComanda.payments ?? []);
    setTotalCents(initialComanda.totalCents);
  }, [initialComanda]);

  const [isAddingItems, setIsAddingItems] = useState(false);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [isReopenOpen, setIsReopenOpen] = useState(false);
  const [pendingCart, setPendingCart] = useState<PendingItem[]>([]);

  const [pendingDebitCents, setPendingDebitCents] = useState(0);
  const [isSettleDebitOpen, setSettleDebitOpen] = useState(false);

  useEffect(() => {
    if (customerId) {
      void getCustomerDebitSummaryAction(customerId).then((summary) => {
        setPendingDebitCents(summary.totalPendingCents);
      });
    } else {
      setPendingDebitCents(0);
    }
  }, [customerId]);

  const [isLinkDialogOpen, setLinkDialogOpen] = useState(false);
  const [isQuickCreateOpen, setQuickCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isClosed = status === "closed";

  async function handleTransferToDebit() {
    if (!customerId || isClosed) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await transferComandaToCustomerDebitAction(comandaId, customerId);
      if (!res.success) {
        setErrorMessage(
          res.reason === "limit_exceeded"
            ? `O cliente excedeu o limite máximo de saldo devedor (R$ ${(res.maxLimitCents! / 100).toFixed(2).replace(".", ",")}).`
            : "Não foi possível transferir a comanda para o saldo devedor."
        );
        setIsSubmitting(false);
        return;
      }
      setStatus("closed");
      router.refresh();
    } catch {
      setErrorMessage("Erro ao transferir comanda. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Manipulação do Carrinho Temporário (Pendentes)
  function handleSelectProduct(product: Product) {
    if (isClosed) return;
    setPendingCart((prev) => {
      const existingIdx = prev.findIndex((item) => item.product.id === product.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: updated[existingIdx].quantity + 1,
        };
        return updated;
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function handleUpdateQuantity(productId: string, delta: number) {
    setPendingCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as PendingItem[]
    );
  }

  function handleRemoveItem(productId: string) {
    setPendingCart((prev) => prev.filter((item) => item.product.id !== productId));
  }

  const pendingTotalCents = pendingCart.reduce(
    (sum, item) => sum + item.product.salePriceCents * item.quantity,
    0
  );

  async function handleConfirmBatchLaunch() {
    if (pendingCart.length === 0 || isClosed) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = pendingCart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      }));

      const result = await addItemsAction(comandaId, payload);
      if (!result.success) {
        setErrorMessage(result.message);
        setIsSubmitting(false);
        return;
      }

      setPendingCart([]);
      setIsAddingItems(false);
      router.refresh();
    } catch {
      setErrorMessage("Não foi possível confirmar o lançamento dos itens. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLinkCustomer(customer: CustomerSearchResult) {
    setErrorMessage(null);
    try {
      const result = await linkCustomerAction(comandaId, customer.id);
      if (!result.success) {
        setErrorMessage(
          result.reason === "customer_already_has_open_comanda"
            ? "Este cliente já possui uma comanda em aberto nesta arena."
            : "Não foi possível vincular o cliente."
        );
        return;
      }
      setCustomerId(customer.id);
      setCustomerName(customer.name);
      setCustomerWhatsapp(customer.whatsapp);
      setLinkDialogOpen(false);
    } catch {
      setErrorMessage("Não foi possível vincular o cliente. Tente novamente.");
    }
  }

  function handleCustomerCreatedForLink(customer: QuickCreatedCustomer) {
    setQuickCreateOpen(false);
    void handleLinkCustomer(customer);
  }

  function handleClosedSuccess() {
    setStatus("closed");
    setIsAddingItems(false);
    router.refresh();
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12">
      {/* Botão de Navegação / Voltar ao Painel */}
      <div className="flex items-center justify-between">
        <Link
          href="/pdv"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-[var(--border)] rounded-[var(--radius-button)] text-xs font-bold text-[var(--text-1)] hover:bg-gray-50 hover:border-[var(--accent)] shadow-sm transition-all active:scale-95"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            className="w-4 h-4 text-[var(--accent)]"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <span>Voltar para a Grade de Comandas</span>
        </Link>
      </div>

      {/* Alerta de Saldo Devedor Pendente */}
      {pendingDebitCents > 0 && customerId && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-[var(--radius-card)] flex flex-wrap items-center justify-between gap-3 text-amber-950 shadow-sm">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-base">⚠️</span>
            <div>
              <p className="font-bold">Cliente com Saldo Devedor Pendente</p>
              <p className="text-[11px] text-amber-800">
                Este cliente possui {formatCentsToBRL(pendingDebitCents)} pendentes em conta de visitas anteriores.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => setSettleDebitOpen(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-8"
          >
            💳 Quitar Débito Agora
          </Button>
        </div>
      )}

      {/* Cabeçalho da Comanda */}
      <div className="flex items-center justify-between flex-wrap gap-4 p-4 bg-white border border-[var(--border)] rounded-[var(--radius-card)] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider text-[var(--text-3)]">
              Comanda #{comandaId.slice(0, 8)}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                isClosed
                  ? "bg-gray-100 text-gray-700 border border-gray-300"
                  : "bg-emerald-100 text-emerald-800 border border-emerald-300"
              }`}
            >
              {isClosed ? "Fechada" : "Aberta"}
            </span>
          </div>
          <h1 className="text-xl font-bold text-[var(--text-1)] mt-1">
            {customerName ?? "Venda Balcão"}
          </h1>
          <div className="flex items-center gap-2 text-xs text-[var(--text-3)] mt-0.5">
            {customerWhatsapp && <span>{customerWhatsapp} •</span>}
            <span>Aberto </span>
            <ElapsedTime fromISO={initialComanda.createdAt} />
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {!customerId && !isClosed && (
            <Button type="button" variant="outline" onClick={() => setLinkDialogOpen(true)}>
              Vincular cliente
            </Button>
          )}

          {!isClosed && !isAddingItems && (
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setIsAddingItems(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-button)] text-white font-semibold text-sm shadow-sm transition-transform active:scale-95"
              style={{ backgroundColor: "var(--accent)" }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Lançar Itens</span>
            </button>
          )}

          {!isClosed && items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setIsCloseDialogOpen(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-button)] text-white font-bold text-sm bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-transform active:scale-95"
            >
              <span>Encerrar & Pagar</span>
            </button>
          )}

          {isClosed && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsReopenOpen(true)}
                className="font-semibold text-xs gap-1.5 border-amber-300 text-amber-900 bg-amber-50/50 hover:bg-amber-100"
              >
                🔄 Estornar / Reabrir Comanda
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => window.print()}
                className="font-semibold text-xs gap-1.5"
              >
                🖨️ Imprimir Extrato
              </Button>
            </div>
          )}
        </div>
      </div>

      {errorMessage && (
        <div
          className="px-4 py-3 rounded-[var(--radius-control)] text-sm font-medium"
          style={{
            backgroundColor: "var(--danger-bg)",
            border: "1px solid var(--danger-border)",
            color: "var(--danger)",
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* SEÇÃO 1: MODO SELEÇÃO/LANÇAMENTO DE ITENS (isAddingItems = true) */}
      {isAddingItems && !isClosed ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-3 border border-[var(--border)] rounded-[var(--radius-card)]">
            <h2 className="text-base font-bold text-[var(--text-1)]">Selecione os produtos para a comanda</h2>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPendingCart([]);
                setIsAddingItems(false);
              }}
              className="text-[var(--danger)] border-[var(--danger-border)] hover:bg-[var(--danger-bg)]"
            >
              ✖ Fechar / Voltar
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            {/* Esquerda: Catálogo por Abas */}
            <div className="lg:col-span-2">
              <ProductSelectorGrid products={products} onSelectProduct={handleSelectProduct} />
            </div>

            {/* Direita: Carrinho Lateral Temporário */}
            <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-4 space-y-4 sticky top-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <h3 className="font-bold text-sm text-[var(--text-1)]">Itens a Lançar</h3>
                <span className="text-xs font-semibold px-2 py-0.5 bg-[var(--bg-sunken)] text-[var(--text-2)] rounded-full">
                  {pendingCart.reduce((sum, i) => sum + i.quantity, 0)} itens
                </span>
              </div>

              {pendingCart.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--text-3)] border border-dashed border-[var(--border)] rounded-md">
                  Toque nos produtos ao lado para adicionar ao lançamento.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                  {pendingCart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex items-center justify-between gap-2 p-2.5 bg-[var(--bg-sunken)] rounded-md text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[var(--text-1)] truncate">{item.product.name}</p>
                        <p className="text-[var(--text-3)]">
                          {formatCentsToBRL(item.product.salePriceCents)} cada
                        </p>
                      </div>

                      {/* Controles de Quantidade */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.product.id, -1)}
                          className="w-7 h-7 flex items-center justify-center font-bold text-sm bg-white border border-[var(--border)] rounded hover:bg-gray-100"
                        >
                          −
                        </button>
                        <span className="w-6 text-center font-bold text-[var(--text-1)]">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.product.id, 1)}
                          className="w-7 h-7 flex items-center justify-center font-bold text-sm bg-white border border-[var(--border)] rounded hover:bg-gray-100"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.product.id)}
                        className="text-[var(--text-3)] hover:text-[var(--danger)] ml-1"
                        title="Remover"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-[var(--border)] space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-[var(--text-2)]">Total a adicionar:</span>
                  <span className="font-bold text-base text-[var(--text-1)]">
                    {formatCentsToBRL(pendingTotalCents)}
                  </span>
                </div>

                <Button
                  type="button"
                  disabled={pendingCart.length === 0 || isSubmitting}
                  onClick={() => void handleConfirmBatchLaunch()}
                  className="w-full h-11 font-semibold text-sm text-white"
                  style={{ backgroundColor: "var(--accent)" }}
                >
                  {isSubmitting ? "Lançando..." : "Confirmar Lançamento"}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setPendingCart([]);
                    setIsAddingItems(false);
                  }}
                  className="w-full text-xs font-semibold text-[var(--text-3)] hover:text-[var(--text-1)] text-center py-1"
                >
                  Cancelar alteração
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* SEÇÃO 2: VISUALIZAÇÃO PADRÃO DA COMANDA */
        <div className="space-y-5">
          <PrintTicketToggle />

          <div className="border border-[var(--border)] rounded-[var(--radius-card)] bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-[var(--bg-sunken)] border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="font-semibold text-sm text-[var(--text-1)]">Itens Lançados</h3>
              <span className="text-xs text-[var(--text-3)]">
                {items.length === 1 ? "1 lançamento" : `${items.length} lançamentos`}
              </span>
            </div>

            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[var(--text-3)] text-xs uppercase border-b border-[var(--border)]">
                <tr>
                  <th className="text-left px-4 py-2.5">Item</th>
                  <th className="text-right px-4 py-2.5">Qtd</th>
                  <th className="text-right px-4 py-2.5">Unit.</th>
                  <th className="text-right px-4 py-2.5">Total</th>
                  {!isClosed && <th className="text-center px-4 py-2.5 w-16">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={isClosed ? 4 : 5} className="px-4 py-8 text-center text-[var(--text-3)]">
                      Nenhum item lançado ainda.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="border-b border-[var(--border)] hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-[var(--text-1)] font-medium">
                        {item.productNameAtSale}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--text-2)]">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-[var(--text-2)]">
                        {formatCentsToBRL(item.unitPriceCentsAtSale)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[var(--text-1)]">
                        {formatCentsToBRL(item.lineTotalCents)}
                      </td>
                      {!isClosed && (
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => setCancellingItem(item)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title="Cancelar este item"
                          >
                            🗑️
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="flex items-center justify-between px-4 py-4 border-t border-[var(--border)] bg-[var(--bg-sunken)]">
              <span className="text-sm font-bold text-[var(--text-2)]">Total Parcial Acumulado</span>
              <span className="text-lg font-extrabold text-[var(--text-1)]">
                {formatCentsToBRL(totalCents)}
              </span>
            </div>
          </div>

          {/* Tabela de Pagamentos (Se Fechada) */}
          {isClosed && payments.length > 0 && (
            <div className="border border-[var(--border)] rounded-[var(--radius-card)] bg-white overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-emerald-50/50 border-b border-[var(--border)] flex items-center justify-between">
                <h3 className="font-bold text-sm text-emerald-900">Resumo de Pagamento</h3>
                <span className="text-xs font-bold text-emerald-700 uppercase">Comanda Quitada</span>
              </div>

              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[var(--text-3)] text-xs uppercase border-b border-[var(--border)]">
                  <tr>
                    <th className="text-left px-4 py-2.5">Meio de Pagamento</th>
                    <th className="text-right px-4 py-2.5">Valor Cobrado</th>
                    <th className="text-right px-4 py-2.5">Valor Recebido</th>
                    <th className="text-right px-4 py-2.5">Troco</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-[var(--border)]">
                      <td className="px-4 py-3 font-semibold text-[var(--text-1)]">
                        {PAYMENT_LABELS[p.paymentMethod] ?? p.paymentMethod}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-[var(--text-1)]">
                        {formatCentsToBRL(p.amountCents - p.changeCents)}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--text-2)]">
                        {p.receivedCents ? formatCentsToBRL(p.receivedCents) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-700 font-medium">
                        {p.changeCents > 0 ? formatCentsToBRL(p.changeCents) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de Fechamento de Comanda */}
      <CloseComandaDialog
        open={isCloseDialogOpen}
        onOpenChange={setIsCloseDialogOpen}
        comandaId={comandaId}
        totalCents={totalCents}
        customerId={customerId}
        onTransferToDebit={() => void handleTransferToDebit()}
        onSuccess={handleClosedSuccess}
      />

      {/* Modal de Quitação de Saldo Devedor */}
      {customerId && customerName && (
        <SettleDebitDialog
          open={isSettleDebitOpen}
          onOpenChange={setSettleDebitOpen}
          customerId={customerId}
          customerName={customerName}
          onSuccess={() => {
            void getCustomerDebitSummaryAction(customerId).then((summary) => {
              setPendingDebitCents(summary.totalPendingCents);
            });
            router.refresh();
          }}
        />
      )}

      {/* Dialog de Vincular Cliente */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular Cliente à Comanda</DialogTitle>
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

      {cancellingItem && (
        <CancelItemDialog
          open={cancellingItem !== null}
          onOpenChange={(open) => {
            if (!open) setCancellingItem(null);
          }}
          comandaId={comandaId}
          comandaItemId={cancellingItem.id}
          itemName={cancellingItem.productNameAtSale}
          isSupervisor={userRole === "admin" || userRole === "gerente"}
        />
      )}

      {isReopenOpen && (
        <ReopenComandaDialog
          open={isReopenOpen}
          onOpenChange={setIsReopenOpen}
          comandaId={comandaId}
          isSupervisor={userRole === "admin" || userRole === "gerente"}
        />
      )}
    </div>
  );
}
