"use client";

import { Switch } from "@/components/ui/switch";

interface PrintTicketToggleProps {
  autoPrint: boolean;
  onChange: (value: boolean) => void;
}

export function PrintTicketToggle({ autoPrint, onChange }: PrintTicketToggleProps) {
  return (
    <label className="flex items-center gap-2 text-sm text-[var(--text-2)] cursor-pointer w-fit">
      <Switch checked={autoPrint} onCheckedChange={onChange} />
      Imprimir ficha de produção automaticamente
    </label>
  );
}
