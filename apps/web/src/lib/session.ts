import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { ArenaUserContext } from "@gestao-de-quadras/core/users/user.service";
import { db } from "@gestao-de-quadras/db";

export interface ArenaSession {
  userId: string;
  username: string;
  tenantSlug: string;
  role: "admin" | "gerente" | "atendente";
  modulesAllowed: string[];
  mustChangePassword: boolean;
}

/** Lê a sessão do operador logado (ou null). */
export async function getArenaSession(): Promise<ArenaSession | null> {
  const session = await auth();
  if (!session) return null;
  const s = session as unknown as {
    user: { id: string };
    tenantSlug?: string;
    username?: string;
    role?: string;
    modulesAllowed?: string[];
    mustChangePassword?: boolean;
  };
  if (!s.tenantSlug || !s.role) return null;
  return {
    userId: s.user.id,
    username: s.username ?? "",
    tenantSlug: s.tenantSlug,
    role: s.role as ArenaSession["role"],
    modulesAllowed: s.modulesAllowed ?? [],
    mustChangePassword: s.mustChangePassword ?? false,
  };
}

/** Exige um operador autenticado; redireciona ao login caso contrário. */
export async function requireSession(): Promise<ArenaSession> {
  const session = await getArenaSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Exige o perfil Admin. Gerente/Atendente são redirecionados (não gerenciam
 * usuários — SAAS-12). Retorna a sessão e o contexto pronto para o core.
 */
export async function requireAdmin(): Promise<{ session: ArenaSession; ctx: ArenaUserContext }> {
  const session = await requireSession();
  if (session.role !== "admin") redirect("/usuarios/negado");
  return {
    session,
    ctx: {
      db,
      schemaName: `tenant_${session.tenantSlug}`,
      actorUserId: session.userId,
    },
  };
}
