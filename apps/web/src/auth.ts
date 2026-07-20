import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, tenants } from "@gestao-de-quadras/db";
import { validateCredentials } from "@gestao-de-quadras/core/auth/auth.service";
import { authConfig } from "./auth.config";

const loginSchema = z.object({
  /** username OU e-mail — o operador pode não ter e-mail (SAAS-12) */
  identifier: z.string().min(1),
  password: z.string().min(1),
  tenantSlug: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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

        // Resolve o tenant pelo slug (subdomínio) — row-level exige o tenant_id
        const [tenant] = await db
          .select({ id: tenants.id })
          .from(tenants)
          .where(eq(tenants.slug, tenantSlug))
          .limit(1);
        if (!tenant) return null;

        const result = await validateCredentials(identifier, password, tenant.id, db);
        if (!result.success) return null;

        return {
          id: result.user.id,
          tenantId: tenant.id,
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
          tenantId: string;
          tenantSlug: string;
          username: string;
          role: string;
          modulesAllowed: string[];
          mustChangePassword: boolean;
        };
        token.userId = u.id;
        token.tenantId = u.tenantId;
        token.tenantSlug = u.tenantSlug;
        token.username = u.username;
        token.role = u.role;
        token.modulesAllowed = u.modulesAllowed;
        token.mustChangePassword = u.mustChangePassword;
      }
      return token;
    },

    session({ session, token }) {
      const t = token as {
        userId: string;
        tenantId: string;
        tenantSlug: string;
        username: string;
        role: string;
        modulesAllowed: string[];
        mustChangePassword: boolean;
      };
      // Os consumidores leem tudo de `session.user` — mantemos os campos lá.
      session.user.id = t.userId;
      session.user.tenantId = t.tenantId;
      session.user.tenantSlug = t.tenantSlug;
      session.user.username = t.username;
      session.user.role = t.role;
      session.user.modulesAllowed = t.modulesAllowed;
      session.user.mustChangePassword = t.mustChangePassword;
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
});
