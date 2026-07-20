"use client";

import { useState } from "react";
import Link from "next/link";
import type { Product } from "@gestao-de-quadras/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2 } from "lucide-react";
import { deleteProductAction } from "@/app/(dashboard)/admin/produtos/_actions/delete-product.action";

const CATEGORIES = ["bebidas", "lanches", "acessórios"];

export function ProductsList({ products: initialProducts }: { products: Product[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !category || p.category === category;
    return matchSearch && matchCat;
  });

  const formatPrice = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

  const handleDelete = async (id: string) => {
    if (!confirm("Deletar este produto?")) return;
    setDeleting(id);
    const result = await deleteProductAction(id);
    if (result.status === "success") {
      setProducts(products.filter((p) => p.id !== id));
    } else {
      alert(result.message);
    }
    setDeleting(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum resultado</div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
                <TableHead className="text-right">Mín.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const low = p.currentStock <= p.minStock;
                return (
                  <TableRow key={p.id} className={low ? "bg-red-50" : ""}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.category}</TableCell>
                    <TableCell className="text-right">{formatPrice(p.salePriceCents)}</TableCell>
                    <TableCell className="text-right">{p.currentStock}</TableCell>
                    <TableCell className="text-right">{p.minStock}</TableCell>
                    <TableCell>
                      <Badge variant={low ? "destructive" : "default"}>{low ? "Baixo" : "OK"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Link href={`/admin/produtos/${p.id}/editar`}>
                          <Button size="sm" variant="outline">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deleting === p.id}
                          onClick={() => handleDelete(p.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
