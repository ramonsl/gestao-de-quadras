import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { createCustomerAction } from "../_actions/create-customer.action";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function NewCustomerPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (!["admin", "gerente", "atendente"].includes(session.user.role ?? "")) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Novo Cliente</h1>

      <form action={createCustomerAction} className="space-y-4">
        <div>
          <label htmlFor="whatsapp" className="block text-sm font-medium mb-2">
            WhatsApp (E.164) *
          </label>
          <input
            type="tel"
            id="whatsapp"
            name="whatsapp"
            placeholder="+5511999999999"
            className="w-full px-3 py-2 border rounded-lg"
            required
            pattern="^\+\d{10,15}$"
          />
          <p className="text-xs text-gray-500 mt-1">
            Formato: +55 seguido do número (ex: +5511999999999)
          </p>
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            Nome Completo *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            placeholder="João Silva"
            className="w-full px-3 py-2 border rounded-lg"
            required
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="joao@email.com"
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label htmlFor="birthDate" className="block text-sm font-medium mb-2">
            Data de Nascimento
          </label>
          <input
            type="date"
            id="birthDate"
            name="birthDate"
            className="w-full px-3 py-2 border rounded-lg"
          />
          <p className="text-xs text-gray-500 mt-1">
            Usado para campanhas de aniversário via WhatsApp
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="optInLgpd"
            name="optInLgpd"
            className="w-4 h-4 border rounded"
          />
          <label htmlFor="optInLgpd" className="text-sm">
            Consentimento para notificações via WhatsApp (LGPD)
          </label>
        </div>

        <div className="flex gap-2 pt-4">
          <Button type="submit">Criar Cliente</Button>
          <Link href="/dashboard/customers">
            <Button variant="outline">Cancelar</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
