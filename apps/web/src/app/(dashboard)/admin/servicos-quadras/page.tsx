import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@gestao-de-quadras/db";
import { getCourtsByTenant } from "@gestao-de-quadras/core/courts/court.service";
import { getCourtServices } from "@gestao-de-quadras/core/courts/court-service.service";
import type { CourtService } from "@gestao-de-quadras/db/schema";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const SERVICE_LABELS = {
  rental: "Locação",
  single_class: "Aula Avulsa",
  package: "Pacote",
};

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default async function ServicosQuadrasPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (!["admin", "gerente"].includes(session.user.role ?? "")) {
    redirect("/dashboard");
  }

  const ctx = { db, tenantId: session.user.tenantId, actorUserId: session.user.id };
  const courts = await getCourtsByTenant(ctx);

  const servicesMap = new Map<string, CourtService[]>();
  for (const court of courts) {
    const services = await getCourtServices(ctx, court.id);
    servicesMap.set(court.id, services);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Serviços das Quadras</h1>
        <Link href="/admin/servicos-quadras/novo">
          <Button>Novo Serviço</Button>
        </Link>
      </div>

      {courts.length === 0 ? (
        <div className="text-center text-gray-500">
          <p>Cadastre quadras primeiro</p>
        </div>
      ) : (
        <div className="space-y-6">
          {courts.map((court) => {
            const services = servicesMap.get(court.id) || [];
            return (
              <div key={court.id} className="border rounded-lg p-4">
                <h2 className="text-xl font-semibold mb-4">{court.name}</h2>
                {services.length === 0 ? (
                  <p className="text-gray-500 text-sm">Nenhum serviço cadastrado</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3">Tipo</th>
                          <th className="text-right py-2 px-3">Preço Base</th>
                          <th className="text-center py-2 px-3">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {services.map((service) => (
                          <tr key={service.id} className="border-b hover:bg-gray-50">
                            <td className="py-2 px-3">
                              {SERVICE_LABELS[service.serviceType as keyof typeof SERVICE_LABELS]}
                            </td>
                            <td className="text-right py-2 px-3">
                              {formatCurrency(service.basePriceInCents)}
                            </td>
                            <td className="text-center py-2 px-3">
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
          })}
        </div>
      )}
    </div>
  );
}
