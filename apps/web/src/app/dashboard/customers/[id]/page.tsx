import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@gestao-de-quadras/db";
import { getCustomerById } from "@gestao-de-quadras/core/customers/customer.service";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (!["admin", "gerente", "atendente"].includes(session.user.role ?? "")) {
    redirect("/dashboard");
  }

  const ctx = { db, schemaName: `tenant_${session.user.tenantSlug}`, actorUserId: session.user.id };
  const customer = await getCustomerById(ctx, params.id);

  if (!customer) {
    redirect("/dashboard/customers");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{customer.name}</h1>
        <Link href="/dashboard/customers">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>

      <div className="border rounded-lg p-6 space-y-4">
        <div>
          <p className="text-sm text-gray-600">WhatsApp</p>
          <p className="text-lg font-medium">{customer.whatsapp}</p>
        </div>

        {customer.email && (
          <div>
            <p className="text-sm text-gray-600">Email</p>
            <p className="text-lg font-medium">{customer.email}</p>
          </div>
        )}

        {customer.birthDate && (
          <div>
            <p className="text-sm text-gray-600">Data de Nascimento</p>
            <p className="text-lg font-medium">
              {new Date(customer.birthDate).toLocaleDateString("pt-BR")}
            </p>
          </div>
        )}

        <div>
          <p className="text-sm text-gray-600">Status</p>
          <span
            className={`inline-block px-3 py-1 rounded text-sm font-medium ${
              customer.status === "active"
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {customer.status === "active" ? "Ativo" : "Inativo"}
          </span>
        </div>

        {customer.globalCustomerId && (
          <div>
            <p className="text-sm text-gray-600">ID Global (Cross-Arena)</p>
            <p className="text-sm font-mono text-gray-500">
              {customer.globalCustomerId}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Este cliente existe em outras arenas do sistema
            </p>
          </div>
        )}

        <div>
          <p className="text-sm text-gray-600">Criado em</p>
          <p className="text-sm text-gray-500">
            {new Date(customer.createdAt).toLocaleString("pt-BR")}
          </p>
        </div>
      </div>

      <div className="flex gap-2 pt-4">
        <Link href="/dashboard/customers">
          <Button variant="outline">Voltar para Clientes</Button>
        </Link>
      </div>
    </div>
  );
}
