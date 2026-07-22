"use client";

import { Badge } from "@/components/ui/badge";

/**
 * PDV-02 AC5 / PDV-12: seletor visível, porém funcionalmente inerte nesta fase
 * — a impressão térmica real (CAD-07/PDV-12) ainda não foi implementada.
 */
export function PrintTicketToggle() {
  return (
    <label
      className="flex items-center gap-2 text-sm text-[var(--text-2)] opacity-60"
      title="Disponível quando a impressão térmica (CAD-07/PDV-12) for implementada"
    >
      <input type="checkbox" disabled className="h-4 w-4 rounded-[var(--radius-control)]" />
      Imprimir ficha de produção
      <Badge variant="outline">Em breve</Badge>
    </label>
  );
}
