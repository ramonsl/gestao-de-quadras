import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTenantDb } from "@gestao-de-quadras/db";
import { getClassPackages } from "@gestao-de-quadras/core/classes/class-package.service";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default async function PacotesAulasPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (!["admin"].includes(session.user.role ?? "")) {
    redirect("/dashboard");
  }

  const tenantDb = getTenantDb(session.user.tenantSlug!);
  const packages = await getClassPackages(tenantDb);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Pacotes de Aulas</h1>
        <Link href="/admin/pacotes-aulas/novo">
          <Button>Novo Pacote</Button>
        </Link>
      </div>

      {packages.length === 0 ? (
        <div className="text-center text-gray-500">
          <p>Nenhum pacote cadastrado</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Nome</th>
                <th className="text-center py-3 px-4">Qtd Aulas</th>
                <th className="text-right py-3 px-4">Preço</th>
                <th className="text-center py-3 px-4">Status</th>
                <th className="text-center py-3 px-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">{pkg.name}</td>
                  <td className="text-center py-3 px-4">{pkg.totalClassCount}</td>
                  <td className="text-right py-3 px-4">
                    {formatCurrency(pkg.priceInCents)}
                  </td>
                  <td className="text-center py-3 px-4">
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        pkg.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {pkg.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="text-center py-3 px-4">
                    <Button variant="outline" size="sm">
                      Editar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
