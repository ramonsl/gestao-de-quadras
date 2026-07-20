import type { DefaultSession } from "next-auth";

/**
 * Augmentation dos tipos do Auth.js (next-auth v5) para o domínio da arena.
 * Os operadores são entidades do tenant (SAAS-12): além dos campos padrão,
 * a sessão carrega tenant, papel e módulos habilitados.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      tenantSlug: string;
      username: string;
      modulesAllowed: string[];
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    tenantSlug?: string;
    username?: string;
    modulesAllowed?: string[];
    mustChangePassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role: string;
    tenantSlug: string;
    username: string;
    modulesAllowed: string[];
    mustChangePassword: boolean;
  }
}

export {};
