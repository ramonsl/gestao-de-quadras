import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getArenaUser, type ArenaUserContext } from "@gestao-de-quadras/core/users/user.service";
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

/**
 * Exige um operador autenticado e **revalida o vínculo no banco**.
 *
 * Os claims do JWT são estáticos até a expiração; sem esta checagem, inativar ou
 * rebaixar um operador não teria efeito sobre uma sessão já emitida — o oposto
 * do que a gestão de usuários promete ao Admin (SAAS-12).
 */
export async function requireSession(): Promise<ArenaSession> {
  const session = await getArenaSession();
  if (!session) redirect("/login");

  const current = await getArenaUser(
    { db, schemaName: `tenant_${session.tenantSlug}`, actorUserId: session.userId },
    session.userId
  );

  if (!current || current.status !== "active") redirect("/login");

  // O perfil/módulos vigentes no banco prevalecem sobre os do token
  return { ...session, role: current.role, modulesAllowed: current.modulesAllowed };
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
