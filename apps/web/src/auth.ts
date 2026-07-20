import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { db } from "@gestao-de-quadras/db";
import { validateCredentials } from "@gestao-de-quadras/core/auth/auth.service";

const loginSchema = z.object({
  /** username OU e-mail — o operador pode não ter e-mail (SAAS-12) */
  identifier: z.string().min(1),
  password: z.string().min(1),
  tenantSlug: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Jornada operacional de um turno; o status do operador ainda é revalidado
  // no banco a cada requisição protegida (ver lib/session.ts).
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },

  providers: [
    Credentials({
      credentials: {
        identifier: { label: "Usuário ou e-mail", type: "text" },
        password: { label: "Senha", type: "password" },
        tenantSlug: { label: "Tenant Slug", type: "text" },
      },

      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { identifier, password, tenantSlug } = parsed.data;

        // Operador é entidade do tenant — autentica no schema da arena (SAAS-12)
        const schemaName = `tenant_${tenantSlug}`;
        const result = await validateCredentials(identifier, password, schemaName, db);
        if (!result.success) return null;

        return {
          id: result.user.id,
          tenantSlug,
          username: result.user.username,
          role: result.user.role,
          modulesAllowed: result.user.modulesAllowed,
          mustChangePassword: result.user.mustChangePassword,
        };
      },
    }),
  ],

  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as unknown as {
          id: string;
          tenantSlug: string;
          username: string;
          role: string;
          modulesAllowed: string[];
          mustChangePassword: boolean;
        };
        token.userId = u.id;
        token.tenantSlug = u.tenantSlug;
        token.username = u.username;
        token.role = u.role;
        token.modulesAllowed = u.modulesAllowed;
        token.mustChangePassword = u.mustChangePassword;
      }
      return token;
    },

    session({ session, token }) {
      const s = session as unknown as Record<string, unknown>;
      session.user.id = token.userId as string;
      s.tenantSlug = token.tenantSlug;
      s.username = token.username;
      s.role = token.role;
      s.modulesAllowed = token.modulesAllowed;
      s.mustChangePassword = token.mustChangePassword;
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
});
