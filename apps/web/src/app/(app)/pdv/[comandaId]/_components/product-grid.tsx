"use client";

import { useMemo, useState } from "react";
import type { Product } from "@gestao-de-quadras/db/schema";
import { formatCentsToBRL } from "@/lib/currency";

interface ProductGridProps {
  products: Product[];
  onAdd: (productId: string, quantity: number) => void;
  disabled?: boolean;
}

function ProductTile({
  product,
  onAdd,
  disabled,
}: {
  product: Product;
  onAdd: (productId: string, quantity: number) => void;
  disabled?: boolean;
}) {
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="border border-[var(--border)] rounded-[var(--radius-card-touch)] p-3 bg-white flex flex-col gap-2">
      <div>
        <p className="text-sm font-medium text-[var(--text-1)] truncate">{product.name}</p>
        <p className="text-xs text-[var(--text-3)]">{formatCentsToBRL(product.salePriceCents)}</p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={disabled}
            className="h-8 w-8 flex items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--bg-sunken)] disabled:opacity-50"
          >
            −
          </button>
          <span className="w-6 text-center text-sm text-[var(--text-1)]">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(999, q + 1))}
            disabled={disabled}
            className="h-8 w-8 flex items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--bg-sunken)] disabled:opacity-50"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onAdd(product.id, quantity);
            setQuantity(1);
          }}
          disabled={disabled}
          className="h-9 px-3 text-sm font-semibold text-white rounded-[var(--radius-button)] disabled:opacity-60"
          style={{ backgroundColor: "var(--accent)" }}
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}

export function ProductGrid({ products, onAdd, disabled }: ProductGridProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) => p.name.toLowerCase().includes(term));
  }, [products, search]);

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filtrar produtos…"
        className="w-full h-9 px-3 text-sm text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-input)] outline-none transition-[border-color] duration-[180ms] placeholder:text-[var(--text-3)] focus:border-[var(--accent)]"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--text-3)]">Nenhum produto encontrado.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((product) => (
            <ProductTile key={product.id} product={product} onAdd={onAdd} disabled={disabled} />
          ))}
        </div>
      )}
    </div>
  );
}
