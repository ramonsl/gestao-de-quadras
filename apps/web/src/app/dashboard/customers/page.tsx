import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@gestao-de-quadras/db";
import { getCustomersByTenant } from "@gestao-de-quadras/core/customers/customer.service";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function CustomersPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (!["admin", "gerente", "atendente"].includes(session.user.role ?? "")) {
    redirect("/dashboard");
  }

  const ctx = { db, tenantId: session.user.tenantId, actorUserId: session.user.id };
  const customers = await getCustomersByTenant(ctx);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Clientes</h1>
        <Link href="/dashboard/customers/new">
          <Button>Novo Cliente</Button>
        </Link>
      </div>

      {customers.length === 0 ? (
        <div className="text-center text-gray-500">
          <p>Nenhum cliente cadastrado</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Nome</th>
                <th className="text-left py-3 px-4">WhatsApp</th>
                <th className="text-left py-3 px-4">Email</th>
                <th className="text-center py-3 px-4">Status</th>
                <th className="text-center py-3 px-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">{customer.name}</td>
                  <td className="py-3 px-4">{customer.whatsapp}</td>
                  <td className="py-3 px-4">{customer.email || "-"}</td>
                  <td className="text-center py-3 px-4">
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        customer.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {customer.status === "active" ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="text-center py-3 px-4">
                    <Link href={`/dashboard/customers/${customer.id}`}>
                      <Button variant="outline" size="sm">
                        Ver
                      </Button>
                    </Link>
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
