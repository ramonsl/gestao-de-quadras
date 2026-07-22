"use client";

import { useActionState } from "react";
import type { Advertiser } from "@gestao-de-quadras/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AdvertiserFormState } from "../_actions/advertiser.actions";

type Action = (prev: AdvertiserFormState, formData: FormData) => Promise<AdvertiserFormState>;

export function AdvertiserForm({ action, initialData }: { action: Action; initialData?: Advertiser }) {
  const [state, formAction] = useActionState<AdvertiserFormState, FormData>(action, { status: "idle" });
  const err = (f: string) => (state.status === "error" ? state.fieldErrors?.[f]?.[0] : undefined);

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      {state.status === "error" && state.message && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div>
        <Label htmlFor="name">Razão social / Nome *</Label>
        <Input id="name" name="name" defaultValue={initialData?.name} required />
        {err("name") && <p className="mt-1 text-xs text-[var(--danger)]">{err("name")}</p>}
      </div>

      <div>
        <Label htmlFor="document">CNPJ / CPF *</Label>
        <Input id="document" name="document" defaultValue={initialData?.document} placeholder="Somente números" required />
        {err("document") && <p className="mt-1 text-xs text-[var(--danger)]">{err("document")}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="email">E-mail (financeiro)</Label>
          <Input id="email" name="email" type="email" defaultValue={initialData?.email ?? ""} />
          {err("email") && <p className="mt-1 text-xs text-[var(--danger)]">{err("email")}</p>}
        </div>
        <div>
          <Label htmlFor="phone">Telefone (financeiro)</Label>
          <Input id="phone" name="phone" defaultValue={initialData?.phone ?? ""} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit">{initialData ? "Salvar" : "Criar anunciante"}</Button>
      </div>
    </form>
  );
}
