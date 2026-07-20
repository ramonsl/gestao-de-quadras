import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db, tenants } from "@gestao-de-quadras/db";

/**
 * Resolve o slug do tenant a partir do Host da requisição ou fallback de env.
 * Em produção com subdomínios (ex.: arena.sistema.com.br), extrai "arena".
 * Em homologação/VPS sem subdomínio próprio, utiliza a env TENANT_SLUG.
 */
export async function resolveTenantSlugFromHost(): Promise<string | null> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";

  const baseDomain = process.env.BASE_DOMAIN ?? "sistema.com.br";
  if (host.includes(`.${baseDomain}`)) {
    const parts = host.split(`.${baseDomain}`)[0];
    if (parts && parts !== host) {
      return parts;
    }
  }

  // Fallback para TENANT_SLUG (útil em dev, staging/homologação via IP ou sslip.io)
  if (process.env.TENANT_SLUG) {
    return process.env.TENANT_SLUG;
  }

  return null;
}

/**
 * Resolve o tenant (slug + id + name) a partir do Host.
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
