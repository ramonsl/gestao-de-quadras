"use client";

import type {
  CustomerComandaHistoryItem,
  CustomerClassBalanceItem,
  CustomerProfileDebit,
} from "@gestao-de-quadras/core/customers/customer-profile.service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatCentsToBRL } from "@/lib/currency";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  pontos: "Pontos",
  conta_cliente: "Conta do Cliente",
};

function paymentLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border)] p-8 text-center text-[13px] text-[var(--text-3)]">
      {children}
    </div>
  );
}

export function ProfileTabs({
  comandas,
  classBalances,
  debit,
}: {
  comandas: CustomerComandaHistoryItem[];
  classBalances: CustomerClassBalanceItem[];
  debit: CustomerProfileDebit;
}) {
  return (
    <Tabs defaultValue="comandas">
      <TabsList>
        <TabsTrigger value="comandas">Comandas</TabsTrigger>
        <TabsTrigger value="reservas">Locações e Reservas</TabsTrigger>
        <TabsTrigger value="aulas">Aulas</TabsTrigger>
        <TabsTrigger value="debito">Saldo Devedor</TabsTrigger>
      </TabsList>

      {/* Aba 1 — Comandas e Vendas */}
      <TabsContent value="comandas">
        <h2 className="text-[13px] font-semibold text-[var(--text-1)] mb-3">Comandas e Vendas</h2>
        {comandas.length === 0 ? (
          <EmptyState>Este cliente ainda não possui comandas nesta arena.</EmptyState>
        ) : (
          <div className="bg-[var(--bg-white)] border border-[var(--border)] rounded-[var(--radius-card)] overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-overline text-[var(--text-3)] border-b border-[var(--border)]">
                  <th className="px-4 py-3">DATA/HORA</th>
                  <th className="px-4 py-3">CÓDIGO</th>
                  <th className="px-4 py-3 text-right">ITENS</th>
                  <th className="px-4 py-3 text-right">TOTAL</th>
                  <th className="px-4 py-3">PAGAMENTO</th>
                  <th className="px-4 py-3">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {comandas.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[var(--border-soft)] last:border-0 hover:bg-[var(--bg-sunken)] transition-colors"
                  >
                    <td className="px-4 py-3 text-[var(--text-2)]">{formatDateTime(c.openedAt)}</td>
                    <td className="px-4 py-3 tabular-nums text-[var(--text-3)]">
                      #{c.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--text-2)]">
                      {c.itemCount}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-[var(--text-1)]">
                      {formatCentsToBRL(c.totalCents)}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-2)]">
                      {c.paymentMethods.length > 0
                        ? c.paymentMethods.map(paymentLabel).join(", ")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={c.status === "closed" ? "outline" : "default"}>
                        {c.status === "closed" ? "Fechada" : "Aberta"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TabsContent>

      {/* Aba 2 — Locações e Reservas (RES-01/PDV-05 não implementado) */}
      <TabsContent value="reservas">
        <EmptyState>
          Histórico de locações e reservas de quadra estará disponível em breve (RES-01).
        </EmptyState>
      </TabsContent>

      {/* Aba 3 — Aulas */}
      <TabsContent value="aulas">
        <h2 className="text-[13px] font-semibold text-[var(--text-1)] mb-3">Pacotes de Aulas</h2>
        {classBalances.length === 0 ? (
          <EmptyState>Nenhum pacote de aulas adquirido nesta arena.</EmptyState>
        ) : (
          <div className="bg-[var(--bg-white)] border border-[var(--border)] rounded-[var(--radius-card)] overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-overline text-[var(--text-3)] border-b border-[var(--border)]">
                  <th className="px-4 py-3">PACOTE</th>
                  <th className="px-4 py-3 text-right">RESTANTES</th>
                  <th className="px-4 py-3">ADQUIRIDO EM</th>
                  <th className="px-4 py-3">VALIDADE</th>
                </tr>
              </thead>
              <tbody>
                {classBalances.map((p, i) => (
                  <tr
                    key={`${p.packageName}-${i}`}
                    className="border-b border-[var(--border-soft)] last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-[var(--text-1)]">{p.packageName}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--text-2)]">
                      {p.remainingClasses} de {p.totalClassCount}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-2)]">
                      {new Date(p.purchasedAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-2)]">
                      {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[11px] text-[var(--text-3)]">
          Registro de presença por aula estará disponível em breve.
        </p>
      </TabsContent>

      {/* Aba 4 — Saldo Devedor */}
      <TabsContent value="debito">
        <h2 className="text-[13px] font-semibold text-[var(--text-1)] mb-3">
          Saldo Devedor e Extrato de Cobrança
        </h2>
        {debit.pendingDebits.length === 0 ? (
          <EmptyState>Nenhum débito pendente. Conta em dia.</EmptyState>
        ) : (
          <div className="bg-[var(--bg-white)] border border-[var(--border)] rounded-[var(--radius-card)] overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-overline text-[var(--text-3)] border-b border-[var(--border)]">
                  <th className="px-4 py-3">ORIGEM</th>
                  <th className="px-4 py-3">DATA</th>
                  <th className="px-4 py-3 text-right">VALOR</th>
                  <th className="px-4 py-3 text-right">PAGO</th>
                  <th className="px-4 py-3 text-right">EM ABERTO</th>
                </tr>
              </thead>
              <tbody>
                {debit.pendingDebits.map((d) => (
                  <tr key={d.id} className="border-b border-[var(--border-soft)] last:border-0">
                    <td className="px-4 py-3 tabular-nums text-[var(--text-3)]">
                      {d.comandaId ? `Comanda #${d.comandaId.slice(0, 8)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-2)]">
                      {new Date(d.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--text-2)]">
                      {formatCentsToBRL(d.amountCents)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--text-2)]">
                      {formatCentsToBRL(d.paidCents)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-[var(--danger)]">
                      {formatCentsToBRL(d.remainingCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
