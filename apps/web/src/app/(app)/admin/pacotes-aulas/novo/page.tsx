import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { createPackageAction } from "../_actions/create-package.action";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function NovoPacoteAulaPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (!["admin"].includes(session.user.role ?? "")) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Novo Pacote de Aulas</h1>

      <form
        action={async (formData: FormData) => {
          "use server";
          await createPackageAction(formData);
        }}
        className="space-y-4"
      >
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            Nome do Pacote
          </label>
          <input
            type="text"
            id="name"
            name="name"
            placeholder="Ex: Pacote Mensal 8 Aulas"
            className="w-full px-3 py-2 border rounded-lg"
            required
          />
        </div>

        <div>
          <label htmlFor="totalClassCount" className="block text-sm font-medium mb-2">
            Quantidade de Aulas
          </label>
          <input
            type="number"
            id="totalClassCount"
            name="totalClassCount"
            placeholder="Ex: 8"
            className="w-full px-3 py-2 border rounded-lg"
            min="1"
            required
          />
        </div>

        <div>
          <label htmlFor="priceInCents" className="block text-sm font-medium mb-2">
            Preço (em R$)
          </label>
          <input
            type="number"
            id="priceInCents"
            name="priceInCents"
            placeholder="Ex: 320.00"
            step="0.01"
            className="w-full px-3 py-2 border rounded-lg"
            min="0"
            required
          />
        </div>

        <div className="flex gap-2">
          <Button type="submit">Criar Pacote</Button>
          <Link href="/admin/pacotes-aulas">
            <Button variant="outline">Cancelar</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
