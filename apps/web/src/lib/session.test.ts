import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * AC2 do SAAS-12: apenas o perfil Admin acessa a gestão de usuários.
 * `requireAdmin`/`requireSession` são o ÚNICO ponto de controle de permissão da
 * US — todas as server actions e páginas dependem deles.
 */

// `redirect` do Next interrompe a execução lançando; o mock reproduz isso para
// que o teste consiga distinguir "redirecionou" de "seguiu adiante".
class RedirectError extends Error {
  constructor(public readonly to: string) {
    super(`REDIRECT:${to}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new RedirectError(to);
  },
}));

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const getArenaUserMock = vi.fn();
vi.mock("@gestao-de-quadras/core/users/user.service", () => ({
  getArenaUser: (...args: unknown[]) => getArenaUserMock(...args),
}));

vi.mock("@gestao-de-quadras/db", () => ({ db: { __fake: true } }));

const { requireAdmin, requireSession } = await import("./session");

function sessionFor(role: string) {
  return {
    user: { id: "11111111-1111-4111-8111-111111111111" },
    tenantSlug: "arena-x",
    username: "operador",
    role,
    modulesAllowed: ["pdv"],
    mustChangePassword: false,
  };
}

function activeUser(role: string) {
  return { id: "11111111-1111-4111-8111-111111111111", role, status: "active", modulesAllowed: ["pdv"] };
}

async function expectRedirect(fn: () => Promise<unknown>, to: string) {
  await expect(fn()).rejects.toThrow(`REDIRECT:${to}`);
}

beforeEach(() => {
  authMock.mockReset();
  getArenaUserMock.mockReset();
});

describe("requireAdmin — AC2: gestão de usuários é exclusiva do Admin", () => {
  it("bloqueia o perfil gerente", async () => {
    authMock.mockResolvedValue(sessionFor("gerente"));
    getArenaUserMock.mockResolvedValue(activeUser("gerente"));

    await expectRedirect(requireAdmin, "/usuarios/negado");
  });

  it("bloqueia o perfil atendente", async () => {
    authMock.mockResolvedValue(sessionFor("atendente"));
    getArenaUserMock.mockResolvedValue(activeUser("atendente"));

    await expectRedirect(requireAdmin, "/usuarios/negado");
  });

  it("permite o Admin e escopa o contexto ao schema do tenant da sessão", async () => {
    authMock.mockResolvedValue(sessionFor("admin"));
    getArenaUserMock.mockResolvedValue(activeUser("admin"));

    const { session, ctx } = await requireAdmin();

    expect(session.role).toBe("admin");
    expect(ctx.schemaName).toBe("tenant_arena-x");
    expect(ctx.actorUserId).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("usa o perfil vigente no banco, não o do token (admin rebaixado é bloqueado)", async () => {
    authMock.mockResolvedValue(sessionFor("admin")); // token defasado
    getArenaUserMock.mockResolvedValue(activeUser("atendente")); // já rebaixado

    await expectRedirect(requireAdmin, "/usuarios/negado");
  });
});

describe("requireSession — revogação de acesso", () => {
  it("derruba operador inativado mesmo com token válido", async () => {
    authMock.mockResolvedValue(sessionFor("admin"));
    getArenaUserMock.mockResolvedValue({ ...activeUser("admin"), status: "inactive" });

    await expectRedirect(requireSession, "/login");
  });

  it("derruba operador removido do tenant", async () => {
    authMock.mockResolvedValue(sessionFor("admin"));
    getArenaUserMock.mockResolvedValue(null);

    await expectRedirect(requireSession, "/login");
  });

  it("redireciona ao login sem sessão", async () => {
    authMock.mockResolvedValue(null);

    await expectRedirect(requireSession, "/login");
  });
});
