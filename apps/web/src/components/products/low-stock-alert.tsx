import type { Product } from "@gestao-de-quadras/db/schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TriangleAlert as AlertTriangle } from "lucide-react";
import Link from "next/link";

export function LowStockAlert({ products }: { products: Product[] }) {
  if (!products.length) return null;
  return (
    <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>{products.length} com estoque baixo</AlertTitle>
    <AlertDescription><ul className="mt-2">{products.slice(0,3).map(p => <li key={p.id}><Link href={`/admin/produtos/${p.id}/editar`} className="underline">{p.name}</Link> ({p.currentStock}/{p.minStock})</li>)}</ul></AlertDescription></Alert>
  );
}
