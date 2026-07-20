import { z } from "zod";
import { and, eq, ilike } from "drizzle-orm";
import { globalCustomers, customers } from "@gestao-de-quadras/db/schema";
import { TenantDb } from "../test/test-db";

const WHATSAPP_E164_REGEX = /^\+(?:[0-9] ?){6,14}[0-9]$/;

export const WhatsappSchema = z
  .string()
  .regex(WHATSAPP_E164_REGEX, "WhatsApp inválido — use formato E.164 (ex: +5511999999999)");

export const CreateGlobalCustomerInputSchema = z.object({
  whatsapp: WhatsappSchema,
  name: z.string().min(1).max(100),
  email: z.string().email().optional().nullable(),
  birthDate: z.date().optional().nullable(),
});

export type CreateGlobalCustomerInput = z.infer<typeof CreateGlobalCustomerInputSchema>;

export interface GlobalCustomer {
  id: string;
  whatsapp: string;
  name: string;
  email: string | null;
  birthDate: Date | null;
  photoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalCustomer {
  id: string;
  globalCustomerId: string | null;
  whatsapp: string;
  name: string;
  email: string | null;
  birthDate: Date | null;
  status: string;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function findOrCreateGlobalCustomer(
  db: any,
  whatsapp: string
): Promise<{ found: boolean; customer: GlobalCustomer }> {
  const validated = WhatsappSchema.parse(whatsapp);

  const existing = await db
    .select()
    .from(globalCustomers)
    .where(eq(globalCustomers.whatsapp, validated))
    .limit(1);

  if (existing.length > 0) {
    return { found: true, customer: existing[0] as GlobalCustomer };
  }

  return { found: false, customer: {} as GlobalCustomer };
}

export async function createGlobalCustomer(
  db: any,
  input: CreateGlobalCustomerInput
): Promise<GlobalCustomer> {
  const validated = CreateGlobalCustomerInputSchema.parse(input);

  const result = await db
    .insert(globalCustomers)
    .values({
      whatsapp: validated.whatsapp,
      name: validated.name,
      email: validated.email || null,
      birthDate: validated.birthDate || null,
    })
    .returning();

  return result[0] as GlobalCustomer;
}

export async function createCustomerInTenant(
  db: TenantDb,
  input: {
    globalCustomerId?: string;
    whatsapp: string;
    name: string;
    email?: string;
    birthDate?: Date;
    createdByUserId: string;
  }
): Promise<LocalCustomer> {
  const result = await db
    .insert(customers)
    .values({
      globalCustomerId: input.globalCustomerId,
      whatsapp: input.whatsapp,
      name: input.name,
      email: input.email,
      birthDate: input.birthDate,
      createdByUserId: input.createdByUserId,
    })
    .returning();

  return result[0] as LocalCustomer;
}

export async function getCustomerById(
  db: TenantDb,
  customerId: string
): Promise<LocalCustomer | null> {
  const result = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);

  return result[0] as LocalCustomer | null;
}

export async function searchCustomersForPdv(
  db: TenantDb,
  query: string
): Promise<LocalCustomer[]> {
  if (!query || query.length < 2) {
    return [];
  }

  const searchTerm = `%${query}%`;

  const result = await db
    .select()
    .from(customers)
    .where(
      query.startsWith("+")
        ? eq(customers.whatsapp, query)
        : ilike(customers.name, searchTerm)
    )
    .limit(10);

  return result as LocalCustomer[];
}

export async function getCustomersByTenant(db: TenantDb): Promise<LocalCustomer[]> {
  const result = await db.select().from(customers).orderBy(customers.name);
  return result as LocalCustomer[];
}

export async function updateCustomer(
  db: TenantDb,
  customerId: string,
  updates: Partial<Omit<LocalCustomer, "id" | "createdAt" | "createdByUserId">>
): Promise<void> {
  await db
    .update(customers)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customerId));
}
