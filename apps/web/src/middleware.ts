import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/recuperar-senha",
  "/redefinir-senha",
  "/ativar-conta",
  "/suspensa",
  "/api/auth",
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PATHS.some((p) => p !== "/" && pathname.startsWith(p));
}

function resolveTenantSlug(request: NextRequest): string | null {
  const host = request.headers.get("host") ?? "";
  const baseDomain = process.env.BASE_DOMAIN ?? "sistema.com.br";

  if (host.endsWith(`.${baseDomain}`)) {
    return host.replace(`.${baseDomain}`, "");
  }

  const tenantParam = request.nextUrl.searchParams.get("tenant");
  if (tenantParam) return tenantParam;

  return process.env.TENANT_SLUG ?? null;
}

export default auth(async (request) => {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const tenantSlug = resolveTenantSlug(request);
  if (!tenantSlug) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const session = request.auth;
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    loginUrl.searchParams.set("tenant", tenantSlug);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};
