import Link from "next/link";
import type { Product } from "@gestao-de-quadras/db/schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export function LowStockAlert({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <Alert variant="destructive" className="border-red-400 bg-red-50">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{products.length} produto(s) com estoque baixo</AlertTitle>
      <AlertDescription>
        <ul className="mt-2 space-y-1">
          {products.slice(0, 5).map((p) => (
            <li key={p.id} className="text-sm">
              <Link href={`/admin/produtos/${p.id}/editar`} className="underline">
                {p.name}
              </Link>{" "}
              ({p.currentStock}/{p.minStock})
            </li>
          ))}
        </ul>
        {products.length > 5 && <p className="text-sm mt-2">... e {products.length - 5} mais</p>}
      </AlertDescription>
    </Alert>
  );
}
