"use client";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Product } from "@gestao-de-quadras/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

type FormState = { status: string; message?: string; fieldErrors?: Record<string, string[]> };

interface ProductFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initialData?: Product;
}

export function ProductForm({ action, initialData }: ProductFormProps) {
  const router = useRouter();
  const [state, form] = useFormState(action, { status: "idle" });

  useEffect(() => {
    if (state.status === "success") { router.push("/admin/produtos"); router.refresh(); }
  }, [state, router]);

  return (
    <form action={form} className="space-y-4 max-w-xl">
      {state.status === "error" && <Alert><AlertDescription>{state.message}</AlertDescription></Alert>}
      <div><Label>Nome *</Label><Input name="name" defaultValue={initialData?.name} required /></div>
      <div><Label>Barcode</Label><Input name="barcode" defaultValue={initialData?.barcode || ""} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Preço (R$) *</Label><Input name="salePriceCents" defaultValue={initialData?.salePriceCents ? (initialData.salePriceCents/100).toFixed(2) : ""} required /></div>
        <div><Label>Categoria *</Label><select name="category" defaultValue={initialData?.category || ""} required><option>Selecione</option><option value="bebidas">Bebidas</option><option value="lanches">Lanches</option><option value="acessórios">Acessórios</option></select></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Estoque Atual</Label><Input type="number" name="currentStock" defaultValue={initialData?.currentStock || 0} /></div>
        <div><Label>Estoque Mín.</Label><Input type="number" name="minStock" defaultValue={initialData?.minStock || 0} /></div>
      </div>
      <div className="flex gap-4">
        <Button type="submit" className="flex-1">{initialData ? "Atualizar" : "Criar"}</Button>
        <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
      </div>
    </form>
  );
}
