"use client";

import { useMemo, useState } from "react";
import type { Product } from "@gestao-de-quadras/db/schema";
import { formatCentsToBRL } from "@/lib/currency";

interface ProductSelectorGridProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
}

export function ProductSelectorGrid({ products, onSelectProduct }: ProductSelectorGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("TODOS");
  const [search, setSearch] = useState<string>("");

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category) set.add(p.category);
    }
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = products;
    if (selectedCategory !== "TODOS") {
      result = result.filter((p) => p.category === selectedCategory);
    }
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(term));
    }
    return result;
  }, [products, selectedCategory, search]);

  return (
    <div className="space-y-4">
      {/* Busca rápida de produtos */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Buscar produto pelo nome..."
        className="w-full h-11 px-4 text-base text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-input)] outline-none transition-colors placeholder:text-[var(--text-3)] focus:border-[var(--accent)]"
      />

      {/* Abas de Categorias */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory("TODOS")}
            className={`px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
              selectedCategory === "TODOS"
                ? "bg-[var(--accent)] text-white shadow-sm"
                : "bg-white text-[var(--text-2)] border border-[var(--border)] hover:bg-[var(--bg-sunken)]"
            }`}
          >
            Todos ({products.length})
          </button>
          {categories.map((cat) => {
            const count = products.filter((p) => p.category === cat).length;
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                  isSelected
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "bg-white text-[var(--text-2)] border border-[var(--border)] hover:bg-[var(--bg-sunken)]"
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Grade de Produtos Touch-friendly */}
      {filteredProducts.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-[var(--border)] rounded-[var(--radius-card)] bg-white">
          <p className="text-sm text-[var(--text-3)]">Nenhum produto encontrado nesta categoria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => onSelectProduct(product)}
              className="flex flex-col justify-between p-4 bg-white border border-[var(--border)] rounded-[var(--radius-card-touch)] hover:border-[var(--accent)] hover:shadow-md active:scale-95 transition-all text-left min-h-[110px]"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div>
                <p className="text-sm font-bold text-[var(--text-1)] line-clamp-2 leading-snug">
                  {product.name}
                </p>
                {product.category && selectedCategory === "TODOS" && (
                  <span className="inline-block text-[10px] uppercase font-semibold text-[var(--text-3)] mt-0.5">
                    {product.category}
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-bold text-[var(--accent)]">
                  {formatCentsToBRL(product.salePriceCents)}
                </span>
                <span className="text-xs font-semibold px-2 py-1 bg-[var(--accent-subtle)] text-[var(--accent)] rounded-full">
                  +1
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
