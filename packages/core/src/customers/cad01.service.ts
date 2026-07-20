/**
 * CAD-01 Serviço Consolidado
 * Cria, busca e gerencia clientes com isolamento de tenant + identidade global.
 */

import { eq, and, like } from "drizzle-orm";

// Mock para tipos (em produção vem do Drizzle)
export interface GlobalCustomer {
  id: string;
  whatsapp: string;
  name: string;
  email?: string;
  birthDate?: string;
  photoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer {
  id: string;
  globalCustomerId?: string;
  whatsapp: string;
  name: string;
  email?: string;
  birthDate?: string;
  status: string;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerOptInLgpd {
  id: string;
  customerId: string;
  optIn: boolean;
  optInAt?: Date;
  optOutAt?: Date;
  changedByUserId?: string;
  changedAt: Date;
}

/**
 * Valida e normaliza WhatsApp para E.164 (+XXXXXXXXXXX)
 */
export function normalizeWhatsapp(input: string): string | null {
  const cleaned = input.replace(/[\s\-()\.+]/g, "");

  if (!cleaned) return null;

  let digits = cleaned;
  let countryCode = "55"; // Brasil default

  // Se tem país no início
  if (cleaned.length > 11) {
    if (cleaned.startsWith("55")) {
      countryCode = "55";
      digits = cleaned.slice(2);
    } else if (cleaned.startsWith("351")) {
      countryCode = "351";
      digits = cleaned.slice(3);
    }
  }

  // Valida Brasil (11 dígitos com 9 no segundo)
  if (countryCode === "55" && digits.length === 11 && digits[2] === "9") {
    return `+${countryCode}${digits}`;
  }

  // Valida Portugal (9 dígitos)
  if (countryCode === "351" && digits.length === 9) {
    return `+${countryCode}${digits}`;
  }

  return null;
}

/**
 * Cria novo cliente LOCAL com vinculação a global (ou cria novo global).
 * AC1, AC2, AC3, AC4
 */
export async function createCustomer(
  tenantDb: any,
  globalDb: any,
  data: {
    whatsapp: string;
    name: string;
    email?: string;
    birthDate?: string;
    createdByUserId: string;
    globalCustomerId?: string;
  }
): Promise<{
  success: boolean;
  customerId?: string;
  globalCustomerId?: string;
  isNewGlobal?: boolean;
  error?: string;
}> {
  try {
    const normalized = normalizeWhatsapp(data.whatsapp);
    if (!normalized) {
      return { success: false, error: "WhatsApp inválido" };
    }

    // Verifica duplicata no tenant
    const existing = await tenantDb
      .select()
      .from("customers")
      .where(eq("whatsapp", normalized))
      .then((r: any[]) => r[0]);

    if (existing) {
      return { success: false, error: "Cliente já existe nesta arena" };
    }

    // Resolve global customer
    let globalId = data.globalCustomerId;
    let isNew = false;

    if (!globalId) {
      const found = await globalDb
        .select()
        .from("global_customers")
        .where(eq("whatsapp", normalized))
        .then((r: any[]) => r[0]);

      if (found) {
        globalId = found.id;
      } else {
        // Cria novo
        const created = await globalDb
          .insert("global_customers")
          .values({
            whatsapp: normalized,
            name: data.name,
            email: data.email || null,
            birthDate: data.birthDate || null,
          })
          .returning()
          .then((r: any[]) => r[0]);
        globalId = created.id;
        isNew = true;
      }
    }

    // Cria cliente local
    const customer = await tenantDb
      .insert("customers")
      .values({
        globalCustomerId: globalId,
        whatsapp: normalized,
        name: data.name,
        email: data.email || null,
        birthDate: data.birthDate || null,
        createdByUserId: data.createdByUserId,
        status: "active",
      })
      .returning()
      .then((r: any[]) => r[0]);

    // Cria opt-in LGPD (default false)
    await tenantDb
      .insert("customer_opt_in_lgpd")
      .values({
        customerId: customer.id,
        optIn: false,
      });

    return {
      success: true,
      customerId: customer.id,
      globalCustomerId: globalId,
      isNewGlobal: isNew,
    };
  } catch (error) {
    return { success: false, error: "Erro ao criar cliente" };
  }
}

/**
 * Busca cliente global por WhatsApp (para confirmação antes de vincular)
 * AC2
 */
export async function findGlobalCustomerByWhatsapp(
  globalDb: any,
  whatsapp: string
): Promise<GlobalCustomer | null> {
  const normalized = normalizeWhatsapp(whatsapp);
  if (!normalized) return null;

  return globalDb
    .select()
    .from("global_customers")
    .where(eq("whatsapp", normalized))
    .then((r: any[]) => r[0] || null);
}

/**
 * Busca clientes locais por nome ou WhatsApp (PDV autocomplete)
 * AC4
 */
export async function searchCustomers(
  tenantDb: any,
  query: string,
  limit = 20
): Promise<Customer[]> {
  if (!query || query.length < 1) return [];

  const normalized = normalizeWhatsapp(query);

  return tenantDb
    .select()
    .from("customers")
    .where(
      and(
        eq("status", "active"),
        normalized
          ? eq("whatsapp", normalized)
          : like("name", `%${query}%`)
      )
    )
    .limit(limit)
    .then((r: any[]) => r || []);
}

/**
 * Atualiza opt-in LGPD (isolado por arena)
 * AC6
 */
export async function updateOptInLgpd(
  tenantDb: any,
  customerId: string,
  optIn: boolean,
  changedByUserId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = new Date();

    await tenantDb
      .update("customer_opt_in_lgpd")
      .set({
        optIn,
        optInAt: optIn ? now : undefined,
        optOutAt: !optIn ? now : undefined,
        changedByUserId,
        changedAt: now,
      })
      .where(eq("customerId", customerId));

    return { success: true };
  } catch (error) {
    return { success: false, error: "Erro ao atualizar consentimento" };
  }
}
