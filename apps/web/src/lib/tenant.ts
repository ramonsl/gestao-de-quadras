import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db, tenants } from "@gestao-de-quadras/db";

/**
 * Resolve o slug do tenant a partir do Host da requisição — mesma regra do
 * middleware. É a ÚNICA fonte confiável: o slug nunca deve vir do formulário
 * (o cliente controla o corpo) nem de `NEXT_PUBLIC_*` (inlinado em build time,
 * o que fixaria uma única arena por build).
 */
export async function resolveTenantSlugFromHost(): Promise<string | null> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";

  const baseDomain = process.env.BASE_DOMAIN ?? "sistema.com.br";
  if (host.endsWith(`.${baseDomain}`)) {
    return host.replace(`.${baseDomain}`, "") || null;
  }

  // Fora de produção aceita-se a env fixa para desenvolvimento local
  if (process.env.NODE_ENV !== "production") {
    return process.env.TENANT_SLUG ?? null;
  }

  return null;
}

/**
 * Resolve o tenant (slug + id + name) a partir do Host. Row-level exige o
 * `tenant_id` (UUID) — retorna null se o Host não mapear uma arena existente.
 */
export async function resolveTenantFromHost(): Promise<
  { slug: string; id: string; name: string } | null
> {
  const slug = await resolveTenantSlugFromHost();
  if (!slug) return null;
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  return tenant ? { slug, id: tenant.id, name: tenant.name } : null;
}
