import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@gestao-de-quadras/db";
import { tenants } from "@gestao-de-quadras/db/schema";
import { eq } from "drizzle-orm";

/** Rotas que não exigem autenticação */
const PUBLIC_PATHS = [
  "/login",
  "/recuperar-senha",
  "/redefinir-senha",
  "/ativar-conta",
  "/suspensa",
  "/api/auth",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

/**
 * Resolve o slug do tenant a partir da requisição.
 * Em produção: extrai o subdomínio (ex.: "arena-x" de "arena-x.sistema.com.br").
 * Em desenvolvimento: usa o query param ?tenant= ou a variável TENANT_SLUG do .env.
 */
function resolveTenantSlug(request: NextRequest): string | null {
  const host = request.headers.get("host") ?? "";

  // Produção: subdomínio (domínio base configurável via env)
  const baseDomain = process.env.BASE_DOMAIN ?? "sistema.com.br";
  if (host.endsWith(`.${baseDomain}`)) {
    return host.replace(`.${baseDomain}`, "");
  }

  // Fora de produção o tenant pode vir por query param ou env fixa. Em produção
  // isso NUNCA é aceito: permitiria acessar outra arena (inclusive suspensa)
  // apenas trocando ?tenant= na URL.
  if (process.env.NODE_ENV !== "production") {
    const tenantParam = request.nextUrl.searchParams.get("tenant");
    if (tenantParam) return tenantParam;
    return process.env.TENANT_SLUG ?? null;
  }

  return null;
}

export default auth(async (request) => {
  const { pathname } = request.nextUrl;

  // Rotas públicas passam sem verificação
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Resolve o tenant
  const tenantSlug = resolveTenantSlug(request);
  if (!tenantSlug) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Verifica status do tenant no banco (suspensão comercial)
  const [tenant] = await db
    .select({ status: tenants.status })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  if (!tenant || tenant.status !== "active") {
    return NextResponse.redirect(new URL("/suspensa", request.url));
  }

  // Verifica autenticação
  const session = request.auth;
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    loginUrl.searchParams.set("tenant", tenantSlug);
    return NextResponse.redirect(loginUrl);
  }

  // A sessão é válida apenas na arena em que foi emitida: um token de outro
  // tenant não pode ser reaproveitado neste host.
  const sessionTenant = (session as unknown as { tenantSlug?: string }).tenantSlug;
  if (sessionTenant !== tenantSlug) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("tenant", tenantSlug);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Aplica o middleware em todas as rotas exceto:
     * - _next/static (arquivos estáticos)
     * - _next/image (otimização de imagens)
     * - favicon.ico, robots.txt
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};
