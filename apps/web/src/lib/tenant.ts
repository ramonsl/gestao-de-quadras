import { headers } from "next/headers";

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
