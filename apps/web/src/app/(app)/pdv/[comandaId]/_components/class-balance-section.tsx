"use client";

import { useState } from "react";
import type { ClassBalanceView } from "@gestao-de-quadras/core/classes/class-balance.service";
import { debitClassAction } from "../_actions/debit-class.action";
import { Button } from "@/components/ui/button";

interface ClassBalanceSectionProps {
  initialBalances: ClassBalanceView[];
}

export function ClassBalanceSection({ initialBalances }: ClassBalanceSectionProps) {
  const [balances, setBalances] = useState(initialBalances);
  const [isOpen, setIsOpen] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totalRemaining = balances.reduce((sum, b) => sum + b.remainingClasses, 0);

  async function handleDebit(balanceId: string) {
    setLoadingId(balanceId);
    setErrorMessage(null);
    try {
      const result = await debitClassAction(balanceId);
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }
      setBalances((prev) =>
        prev.map((b) => (b.id === balanceId ? { ...b, remainingClasses: result.remainingClasses } : b))
      );
    } catch {
      setErrorMessage("Erro ao debitar aula. Tente novamente.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="border border-[var(--border)] rounded-[var(--radius-card)] bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-sunken)] border-b border-[var(--border)] hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-[var(--text-1)]">Saldo de Aulas</span>
          {totalRemaining > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--accent)]/10 text-[var(--accent)]">
              {totalRemaining} aula{totalRemaining !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <span className="text-[var(--text-3)] text-xs">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="p-4 space-y-3">
          {errorMessage && (
            <div
              className="px-3 py-2 rounded text-xs font-medium"
              style={{
                backgroundColor: "var(--danger-bg)",
                border: "1px solid var(--danger-border)",
                color: "var(--danger)",
              }}
            >
              {errorMessage}
            </div>
          )}

          {balances.length === 0 ? (
            <p className="text-xs text-[var(--text-3)] text-center py-4">
              Nenhum saldo de aulas ativo para este cliente.
            </p>
          ) : (
            <div className="space-y-2">
              {balances.map((balance) => {
                const isExhausted = balance.remainingClasses === 0;
                const isLoading = loadingId === balance.id;
                return (
                  <div
                    key={balance.id}
                    className="flex items-center justify-between gap-3 p-3 bg-[var(--bg-sunken)] rounded-[var(--radius-card)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-[var(--text-1)] truncate">
                        {balance.packageName}
                      </p>
                      <p className="text-xs text-[var(--text-3)]">
                        {isExhausted ? (
                          <span className="text-[var(--danger)]">Saldo esgotado</span>
                        ) : (
                          <>
                            <span className="font-bold text-[var(--text-1)]">{balance.remainingClasses}</span>{" "}
                            aula{balance.remainingClasses !== 1 ? "s" : ""} restante{balance.remainingClasses !== 1 ? "s" : ""}
                          </>
                        )}
                      </p>
                    </div>
                    <span
                      title={isExhausted ? "Saldo esgotado para este pacote." : undefined}
                      className="inline-flex"
                    >
                      <Button
                        type="button"
                        size="sm"
                        disabled={isExhausted || isLoading}
                        onClick={() => void handleDebit(balance.id)}
                        className={`font-semibold text-xs h-11 px-3 whitespace-nowrap${!isExhausted ? " text-white" : ""}`}
                        style={
                          !isExhausted
                            ? { backgroundColor: "var(--accent)" }
                            : undefined
                        }
                        variant={isExhausted ? "outline" : "default"}
                      >
                        {isLoading ? "Debitando..." : "Debitar 1 Aula"}
                      </Button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
