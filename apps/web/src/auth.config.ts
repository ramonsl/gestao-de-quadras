import type { NextAuthConfig } from "next-auth";

/**
 * Configuração leve do Auth.js compatível com Edge Middleware.
 * Não importa módulos nativos do Node.js (como argon2/fs).
 */
export const authConfig = {
  session: { strategy: "jwt" },
  providers: [], // Providers alimentados no auth.ts (Node runtime)
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isPublicPath = [
        "/login",
        "/recuperar-senha",
        "/redefinir-senha",
        "/ativar-conta",
        "/suspensa",
        "/api/auth",
      ].some((p) => nextUrl.pathname.startsWith(p));

      if (isPublicPath) return true;
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
