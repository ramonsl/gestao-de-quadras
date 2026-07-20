"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Product } from "@gestao-de-quadras/db/schema";

type FormState = { status: string; message?: string; fieldErrors?: Record<string, string[]> };

interface ProductFormProps {
  action: (prev: any, formData: FormData) => Promise<FormState>;
  initialData?: Product;
}

const labelCls = "block text-xs font-semibold text-[var(--text-2)] mb-1.5";
const inputCls =
  "w-full h-9 px-3 text-sm text-[var(--text-1)] bg-white border border-[var(--border)] rounded-[var(--radius-input)] outline-none transition-[border-color] duration-[180ms] placeholder:text-[var(--text-3)] focus:border-[var(--accent)]";

export function ProductForm({ action, initialData }: ProductFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, { status: "idle" });

  useEffect(() => {
    if (state.status === "success") {
      router.push("/admin/produtos");
      router.refresh();
    }
  }, [state.status, router]);

  return (
    <form
      action={formAction}
      className="max-w-2xl bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-6 space-y-5"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {state.status === "error" && (
        <div
          className="px-3 py-2.5 rounded-[var(--radius-control)] text-sm"
          style={{
            backgroundColor: "var(--danger-bg)",
            border: "1px solid var(--danger-border)",
            color: "var(--danger)",
          }}
        >
          {state.message}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className={labelCls}>Nome do produto *</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={initialData?.name}
            placeholder="Ex.: Água Mineral 500ml"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="barcode" className={labelCls}>Código de barras (opcional)</label>
          <input
            id="barcode"
            name="barcode"
            type="text"
            defaultValue={initialData?.barcode || ""}
            placeholder="Ex.: 7891234567890"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="salePriceCents" className={labelCls}>Preço de venda (R$) *</label>
          <input
            id="salePriceCents"
            name="salePriceCents"
            type="text"
            required
            defaultValue={initialData?.salePriceCents ? (initialData.salePriceCents / 100).toFixed(2) : ""}
            placeholder="5.00"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="category" className={labelCls}>Categoria *</label>
          <select
            id="category"
            name="category"
            required
            defaultValue={initialData?.category || "bebidas"}
            className={inputCls}
          >
            <option value="bebidas">Bebidas</option>
            <option value="lanches">Lanches</option>
            <option value="acessórios">Acessórios</option>
            <option value="vestuário">Vestuário</option>
          </select>
        </div>

        <div>
          <label htmlFor="currentStock" className={labelCls}>Estoque atual *</label>
          <input
            id="currentStock"
            name="currentStock"
            type="number"
            required
            defaultValue={initialData?.currentStock ?? 0}
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="minStock" className={labelCls}>Estoque mínimo (alerta) *</label>
          <input
            id="minStock"
            name="minStock"
            type="number"
            required
            defaultValue={initialData?.minStock ?? 5}
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-3">
        <button
          type="submit"
          disabled={pending}
          className="h-9 px-4 text-sm font-semibold text-white rounded-[var(--radius-button)] transition-colors duration-[180ms] disabled:opacity-60"
          style={{ backgroundColor: "var(--accent)" }}
        >
          {pending ? "Salvando…" : initialData ? "Salvar alterações" : "Criar produto"}
        </button>
        <Link href="/admin/produtos" className="text-sm text-[var(--text-3)] hover:text-[var(--text-2)]">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
