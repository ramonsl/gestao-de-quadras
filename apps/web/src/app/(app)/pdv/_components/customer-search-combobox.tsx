"use client";

import { useEffect, useState, useTransition } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  searchCustomersAction,
  type CustomerSearchResult,
} from "../_actions/search-customers.action";

const inputCls =
  "w-full h-9 px-3 text-sm text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-input)] outline-none transition-[border-color] duration-[180ms] placeholder:text-[var(--text-3)] focus:border-[var(--accent)]";

interface CustomerSearchComboboxProps {
  onSelect: (customer: CustomerSearchResult) => void;
  /** Renderizado abaixo da lista quando a busca não encontra ninguém. */
  emptyStateSlot?: React.ReactNode;
}

export function CustomerSearchCombobox({ onSelect, emptyStateSlot }: CustomerSearchComboboxProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    startTransition(async () => {
      const found = await searchCustomersAction(debouncedQuery.trim());
      setResults(found);
      setHasSearched(true);
    });
  }, [debouncedQuery]);

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nome ou WhatsApp (+55...)"
        className={inputCls}
      />

      {isPending && <p className="text-xs text-[var(--text-3)]">Buscando…</p>}

      {!isPending && results.length > 0 && (
        <ul className="border border-[var(--border)] rounded-[var(--radius-card)] divide-y divide-[var(--border)] overflow-hidden">
          {results.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                onClick={() => onSelect(customer)}
                className="w-full text-left px-3 py-2 hover:bg-[var(--bg-sunken)] transition-colors"
              >
                <p className="text-sm font-medium text-[var(--text-1)]">{customer.name}</p>
                <p className="text-xs text-[var(--text-3)]">{customer.whatsapp}</p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!isPending && hasSearched && results.length === 0 && (
        <div className="text-sm text-[var(--text-3)] px-1 py-1.5">
          Nenhum cliente encontrado.
          {emptyStateSlot}
        </div>
      )}
    </div>
  );
}
