"use client";
import { useState } from "react";
import Link from "next/link";
import type { Product } from "@gestao-de-quadras/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2 } from "lucide-react";

export function ProductsList({ products: init }: { products: Product[] }) {
  const [list, setList] = useState(init);
  const [search, setSearch] = useState("");

  const filtered = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
      <Table>
        <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Categ.</TableHead><TableHead>Preço</TableHead><TableHead>Estoque</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
        <TableBody>{filtered.map(p => (
          <TableRow key={p.id} className={p.currentStock <= p.minStock ? "bg-red-50" : ""}>
            <TableCell>{p.name}</TableCell><TableCell>{p.category}</TableCell><TableCell>R$ {(p.salePriceCents/100).toFixed(2)}</TableCell>
            <TableCell>{p.currentStock} <Badge variant={p.currentStock <= p.minStock ? "destructive" : "default"}>{p.currentStock <= p.minStock ? "Baixo" : "OK"}</Badge></TableCell>
            <TableCell className="flex gap-2"><Link href={`/admin/produtos/${p.id}/editar`}><Button size="sm"><Edit className="w-4" /></Button></Link></TableCell>
          </TableRow>
        ))}</TableBody>
      </Table>
    </div>
  );
}
