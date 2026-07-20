"use client";

import { useState } from "react";
import Link from "next/link";
import type { Product } from "@gestao-de-quadras/db/schema";
import { deleteProductAction } from "@/app/(app)/admin/produtos/_actions/delete-product.action";

export function ProductsList({ products: init }: { products: Product[] }) {
  const [list, setList] = useState(init);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja inativar/deletar este produto?")) return;
    setDeleting(id);
    const result = await deleteProductAction(id);
    if (result.status === "success") {
      setList(list.filter((p) => p.id !== id));
    } else {
      alert(result.message || "Erro ao deletar");
    }
    setDeleting(null);
  };

  const filtered = list.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (list.length === 0) {
    return (
      <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-8 text-center text-sm text-[var(--text-3)]">
        Nenhum produto cadastrado ainda.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <input
          type="text"
          placeholder="Buscar produto pelo nome…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-64 px-3 text-sm bg-white border border-[var(--border)] rounded-[var(--radius-input)] outline-none focus:border-[var(--accent)]"
        />
        <p className="text-[11px] text-[var(--text-3)]">{filtered.length} produto(s) exibido(s)</p>
      </div>

      <div className="bg-white border border-[var(--border)] rounded-[var(--radius-card)] overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-overline text-[var(--text-3)] border-b border-[var(--border)]">
              <th className="px-4 py-3">PRODUTO · CATEGORIA</th>
              <th className="px-4 py-3">PREÇO DE VENDA</th>
              <th className="px-4 py-3">ESTOQUE ATUAL</th>
              <th className="px-4 py-3 text-right">AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const isLowStock = p.currentStock <= p.minStock;
              return (
                <tr
                  key={p.id}
                  className="border-b border-[var(--border-soft)] last:border-0 hover:bg-[var(--bg-sunken)] transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--text-1)]">{p.name}</div>
                    <div className="text-[var(--text-3)]">{p.category}</div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[var(--text-1)]">
                    R$ {(p.salePriceCents / 100).toFixed(2).replace(".", ",")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`font-medium ${
                        isLowStock ? "text-[var(--danger)]" : "text-[var(--text-1)]"
                      }`}
                    >
                      {p.currentStock} un.
                    </span>
                    {isLowStock && (
                      <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--danger-bg)] text-[var(--danger)] border border-[var(--danger-border)]">
                        Estoque Baixo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/admin/produtos/${p.id}/editar`}
                        className="text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium"
                      >
                        Editar
                      </Link>
                      <button
                        type="button"
                        disabled={deleting === p.id}
                        onClick={() => handleDelete(p.id)}
                        className="text-[var(--danger)] hover:opacity-80 disabled:opacity-50"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
