import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { db } from "@gestao-de-quadras/db";
import { validateCredentials } from "@gestao-de-quadras/core/auth/auth.service";
import { sql } from "drizzle-orm";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },

  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
        tenantSlug: { label: "Tenant Slug", type: "text" },
      },

      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password, tenantSlug } = parsed.data;

        // Valida credenciais no schema público
        const result = await validateCredentials(email, password, db);
        if (!result.success) return null;

        // Busca vínculo do usuário com o tenant no schema tenant_<slug>
        const schemaName = `tenant_${tenantSlug}`;
        const query = sql.raw(
          `SELECT id, role, modules_allowed, status FROM "${schemaName}".users_tenants WHERE user_id = '${result.userId}' LIMIT 1`
        );

        const resultQuery = await db.execute<{
          id: string;
          role: string;
          modules_allowed: string;
          status: string;
        }>(query);

        const link = (resultQuery.rows as unknown as Array<{
          id: string;
          role: string;
          modules_allowed: string;
          status: string;
        }>)[0];

        if (!link || link.status !== "active") return null;

        const modulesAllowed: string[] = JSON.parse(link.modules_allowed || "[]");

        return {
          id: result.userId,
          email,
          tenantSlug,
          role: link.role,
          modulesAllowed,
        };
      },
    }),
  ],

  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.tenantSlug = (user as unknown as { tenantSlug: string }).tenantSlug;
        token.role = (user as unknown as { role: string }).role;
        token.modulesAllowed = (user as unknown as { modulesAllowed: string[] }).modulesAllowed;
      }
      return token;
    },

    session({ session, token }) {
      session.user.id = token.userId as string;
      (session as unknown as Record<string, unknown>).tenantSlug = token.tenantSlug;
      (session as unknown as Record<string, unknown>).role = token.role;
      (session as unknown as Record<string, unknown>).modulesAllowed = token.modulesAllowed;
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
});
