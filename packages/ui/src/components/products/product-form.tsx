"use client";

import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import type { Product } from "@gestao-de-quadras/db/schema";

const CATEGORIES = ["bebidas", "lanches", "acessórios"];

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function parseCents(value: string): number {
  const normalized = value.replace(",", ".");
  return Math.round(parseFloat(normalized) * 100) || 0;
}

export function ProductForm({ action, initialData }: { action: any; initialData?: Product }) {
  const router = useRouter();
  const [state, formAction] = useFormState(action, { status: "idle" });

  useEffect(() => {
    if (state.status === "success") {
      router.push("/admin/produtos");
      router.refresh();
    }
  }, [state, router]);

  const handleSubmit = (formData: FormData) => {
    const priceStr = formData.get("salePriceCents") as string;
    if (priceStr) {
      formData.set("salePriceCents", String(parseCents(priceStr)));
    }
    formAction(formData);
  };

  return (
    <form action={handleSubmit} className="space-y-6 max-w-2xl">
      {state.status === "error" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Nome *</Label>
        <Input id="name" name="name" defaultValue={initialData?.name} required />
        {state.fieldErrors?.name && <p className="text-xs text-red-600">{state.fieldErrors.name[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="barcode">Código de Barras</Label>
        <Input id="barcode" name="barcode" defaultValue={initialData?.barcode || ""} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="salePriceCents">Preço (R$) *</Label>
          <Input
            id="salePriceCents"
            name="salePriceCents"
            defaultValue={initialData ? formatCents(initialData.salePriceCents) : ""}
            required
          />
          {state.fieldErrors?.salePriceCents && (
            <p className="text-xs text-red-600">{state.fieldErrors.salePriceCents[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Categoria *</Label>
          <Select defaultValue={initialData?.category || ""}>
            <SelectTrigger asChild>
              <select id="category" name="category" required>
                <option value="">Selecione</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </SelectTrigger>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="currentStock">Estoque Atual</Label>
          <Input id="currentStock" name="currentStock" type="number" defaultValue={initialData?.currentStock || 0} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="minStock">Estoque Mínimo</Label>
          <Input id="minStock" name="minStock" type="number" defaultValue={initialData?.minStock || 0} />
        </div>
      </div>

      <div className="flex gap-4">
        <Button type="submit" className="flex-1">
          {initialData ? "Atualizar" : "Criar"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
