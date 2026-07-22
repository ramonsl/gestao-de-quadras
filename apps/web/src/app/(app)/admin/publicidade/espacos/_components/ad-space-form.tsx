"use client";

import { useActionState } from "react";
import type { AdSpace } from "@gestao-de-quadras/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AdSpaceFormState } from "../_actions/ad-space.actions";

export const AD_SPACE_TYPE_LABELS: Record<string, string> = {
  placa_fisica: "Placa física",
  lona: "Lona",
  banner_digital: "Banner digital",
};

export const AD_SPACE_STATUS_LABELS: Record<string, string> = {
  disponivel: "Disponível",
  ocupado: "Ocupado",
  manutencao: "Manutenção",
};

type Action = (prev: AdSpaceFormState, formData: FormData) => Promise<AdSpaceFormState>;

export function AdSpaceForm({ action, initialData }: { action: Action; initialData?: AdSpace }) {
  const [state, formAction] = useActionState<AdSpaceFormState, FormData>(action, { status: "idle" });
  const err = (f: string) => (state.status === "error" ? state.fieldErrors?.[f]?.[0] : undefined);

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      {state.status === "error" && state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div>
        <Label htmlFor="name">Identificação *</Label>
        <Input id="name" name="name" defaultValue={initialData?.name} placeholder="Ex.: Placa 1 - Fundo da Quadra 1" required />
        {err("name") && <p className="mt-1 text-xs text-[var(--danger)]">{err("name")}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="spaceType">Tipo *</Label>
          <select
            id="spaceType"
            name="spaceType"
            defaultValue={initialData?.spaceType ?? "placa_fisica"}
            className="flex h-10 w-full rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--bg-white)] px-3 py-2 text-sm"
          >
            {Object.entries(AD_SPACE_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="status">Status *</Label>
          <select
            id="status"
            name="status"
            defaultValue={initialData?.status ?? "disponivel"}
            className="flex h-10 w-full rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--bg-white)] px-3 py-2 text-sm"
          >
            {Object.entries(AD_SPACE_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label htmlFor="referencePrice">Valor de referência (R$) *</Label>
        <Input
          id="referencePrice"
          name="referencePrice"
          inputMode="decimal"
          defaultValue={initialData ? (initialData.referencePriceCents / 100).toFixed(2) : ""}
          placeholder="0,00"
          required
        />
        {err("referencePrice") && <p className="mt-1 text-xs text-[var(--danger)]">{err("referencePrice")}</p>}
      </div>

      <div className="flex gap-2">
        <Button type="submit">{initialData ? "Salvar" : "Criar espaço"}</Button>
      </div>
    </form>
  );
}
