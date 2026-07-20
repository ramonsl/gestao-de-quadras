import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getArenaUser, type ArenaUserContext } from "@gestao-de-quadras/core/users/user.service";
import { db } from "@gestao-de-quadras/db";

export interface ArenaSession {
  userId: string;
  username: string;
  /** UUID da arena (public.tenants.id). */
  tenantId: string;
  tenantSlug: string;
  role: "admin" | "gerente" | "atendente";
  modulesAllowed: string[];
  mustChangePassword: boolean;
}

/** Lê a sessão do operador logado (ou null). */
export async function getArenaSession(): Promise<ArenaSession | null> {
  const session = await auth();
  const u = session?.user;
  if (!u?.tenantId || !u?.role) return null;
  return {
    userId: u.id,
    username: u.username ?? "",
    tenantId: u.tenantId,
    tenantSlug: u.tenantSlug,
    role: u.role as ArenaSession["role"],
    modulesAllowed: u.modulesAllowed ?? [],
    mustChangePassword: u.mustChangePassword ?? false,
  };
}

function contextFor(session: ArenaSession): ArenaUserContext {
  return { db, tenantId: session.tenantId, actorUserId: session.userId };
}

/**
 * Retorna a sessão + o contexto de tenant (row-level) pronto para o core, sem
 * redirecionar. Para uso em server actions que devolvem erro em vez de navegar.
 */
export async function getArenaContext(): Promise<
  { session: ArenaSession; ctx: ArenaUserContext } | null
> {
  const session = await getArenaSession();
  if (!session) return null;
  return { session, ctx: contextFor(session) };
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

  const current = await getArenaUser(contextFor(session), session.userId);
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
  return { session, ctx: contextFor(session) };
}
