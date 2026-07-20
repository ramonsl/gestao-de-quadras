import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { createCourtAction } from "../_actions/create-court.action";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function NovaQuadraPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (!["admin", "gerente"].includes(session.user.role ?? "")) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Nova Quadra</h1>

      <form
        action={async (formData: FormData) => {
          "use server";
          await createCourtAction(formData);
        }}
        className="space-y-4"
      >
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            Nome da Quadra
          </label>
          <input
            type="text"
            id="name"
            name="name"
            placeholder="Ex: Quadra 1 - Vidro"
            className="w-full px-3 py-2 border rounded-lg"
            required
          />
        </div>

        <div>
          <label htmlFor="modality" className="block text-sm font-medium mb-2">
            Modalidade
          </label>
          <select
            id="modality"
            name="modality"
            className="w-full px-3 py-2 border rounded-lg"
            required
          >
            <option value="">Selecione uma modalidade</option>
            <option value="Padel">Padel</option>
            <option value="Beach Tennis">Beach Tennis</option>
          </select>
        </div>

        <div className="flex gap-2">
          <Button type="submit">Criar Quadra</Button>
          <Link href="/admin/quadras">
            <Button variant="outline">Cancelar</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
