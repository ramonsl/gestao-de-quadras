"use server";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@gestao-de-quadras/db";
import {
  findOrCreateGlobalCustomer,
  createGlobalCustomer,
  createCustomerInTenant,
} from "@gestao-de-quadras/core/customers/customer.service";
import { z } from "zod";

const CreateCustomerSchema = z.object({
  whatsapp: z.string().regex(/^\+\d{10,15}$/, "WhatsApp inválido"),
  name: z.string().min(1, "Nome obrigatório").max(100),
  email: z.string().email().optional(),
  birthDate: z.string().optional(),
  optInLgpd: z.boolean().optional().default(false),
});

export async function createCustomerAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (!["admin", "gerente", "atendente"].includes(session.user.role ?? "")) {
    throw new Error("Acesso negado");
  }

  const whatsapp = formData.get("whatsapp");
  const name = formData.get("name");
  const email = formData.get("email");
  const birthDate = formData.get("birthDate");
  const optInLgpd = formData.get("optInLgpd") === "on";

  const result = CreateCustomerSchema.safeParse({
    whatsapp,
    name,
    email,
    birthDate,
    optInLgpd,
  });

  if (!result.success) {
    return { error: result.error.flatten().fieldErrors };
  }

  try {
    const ctx = {
      db,
      tenantId: session.user.tenantId,
      actorUserId: session.user.id,
    };

    // Buscar ou criar cliente global (schema public)
    const { found, customer: globalCustomer } = await findOrCreateGlobalCustomer(
      db,
      result.data.whatsapp
    );

    let globalCustomerId: string;

    if (found && globalCustomer.id) {
      globalCustomerId = globalCustomer.id;
    } else {
      const newGlobal = await createGlobalCustomer(db, {
        whatsapp: result.data.whatsapp,
        name: result.data.name,
        email: result.data.email,
        birthDate: result.data.birthDate
          ? new Date(result.data.birthDate)
          : undefined,
      });
      globalCustomerId = newGlobal.id;
    }

    // Criar cliente local
    const customer = await createCustomerInTenant(ctx, {
      globalCustomerId,
      whatsapp: result.data.whatsapp,
      name: result.data.name,
      email: result.data.email,
      birthDate: result.data.birthDate
        ? new Date(result.data.birthDate)
        : undefined,
      createdByUserId: session.user.id,
    });

    return { success: true, customer };
  } catch (error) {
    console.error("Erro ao criar cliente:", error);
    return { error: "Erro ao criar cliente. Tente novamente." };
  }
}
