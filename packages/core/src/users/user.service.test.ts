import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createArenaUser,
  updateArenaUser,
  deactivateArenaUser,
  reactivateArenaUser,
  resetArenaUserPassword,
  listArenaUsers,
  getArenaUser,
  type ArenaUserContext,
  type CreateArenaUserInput,
  type UpdateArenaUserInput,
} from "./user.service";
import { createMockDb, type MockDb } from "../test/sql-mock";

// ---------------------------------------------------------------------------
// argon2 mockado — os testes não devem calcular hash real (lento) e precisam de
// um valor previsível para provar que ele NUNCA vaza nos logs de auditoria.
// ---------------------------------------------------------------------------

const { HASH_SENTINEL } = vi.hoisted(() => ({ HASH_SENTINEL: "argon2::hashed-sentinel" }));
vi.mock("@node-rs/argon2", () => ({
  hash: vi.fn().mockResolvedValue(HASH_SENTINEL),
  verify: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Factories (dados de teste sempre criados por factory — nunca dependem de
// estado de outro teste)
// ---------------------------------------------------------------------------

const TENANT_A = "11111111-1111-1111-1111-111111111111";

function makeCtx(mock: MockDb, tenantId = TENANT_A): ArenaUserContext {
  return { db: mock.db, tenantId, actorUserId: "admin-actor-id" };
}

interface UserRowOverrides {
  id?: string;
  username?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  role?: "admin" | "gerente" | "atendente";
  modules_allowed?: string;
  status?: "active" | "inactive";
  must_change_password?: boolean;
  last_login_at?: Date | null;
}

function makeUserRow(overrides: UserRowOverrides = {}): Record<string, unknown> {
  return {
    id: "user-1",
    username: "operador",
    name: "Operador Um",
    email: "operador@arena.com",
    phone: null,
    role: "atendente",
    modules_allowed: '["pdv"]',
    status: "active",
    must_change_password: false,
    last_login_at: null,
    ...overrides,
  };
}

function makeCreateInput(overrides: Partial<CreateArenaUserInput> = {}): CreateArenaUserInput {
  return {
    name: "Novo Operador",
    username: "novo.operador",
    password: "senhaForte1",
    email: "novo@arena.com",
    phone: undefined,
    role: "atendente",
    modulesAllowed: ["pdv"],
    mustChangePassword: false,
    ...overrides,
  } as CreateArenaUserInput;
}

function makeUpdateInput(overrides: Partial<UpdateArenaUserInput> = {}): UpdateArenaUserInput {
  return {
    name: "Operador Editado",
    email: undefined,
    phone: undefined,
    role: "atendente",
    modulesAllowed: ["pdv"],
    mustChangePassword: false,
    ...overrides,
  } as UpdateArenaUserInput;
}

function userInsert(mock: MockDb) {
  return mock.calls.find((c) => /INSERT INTO/i.test(c.text) && /users_tenants/.test(c.text));
}
function userUpdate(mock: MockDb) {
  return mock.calls.find((c) => /UPDATE/i.test(c.text) && /users_tenants/.test(c.text));
}

beforeEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// AC2 / AC "Campos e criação" — createArenaUser
// ---------------------------------------------------------------------------

describe("createArenaUser", () => {
  it("cria operador COM e-mail; conta nasce ativa e grava audit user.created", async () => {
    const mock = createMockDb({ newUserId: "created-1" });
    const result = await createArenaUser(makeCreateInput(), makeCtx(mock));

    expect(result).toEqual({ success: true, userId: "created-1" });

    const insert = userInsert(mock)!;
    expect(insert).toBeDefined();
    // conta ativa imediatamente (login imediato) + activated_at now()
    expect(insert.text).toMatch(/'active'/);
    expect(insert.text).toMatch(/activated_at/);
    expect(insert.text).toMatch(/now\(\)/);
    // a senha entra como hash (argon2), nunca em texto plano
    expect(insert.params).toContain(HASH_SENTINEL);
    expect(insert.params).not.toContain("senhaForte1");

    const audit = mock.auditFor("user.created")!;
    expect(audit).toBeDefined();
    const details = audit.params.find((p) => typeof p === "string" && p.startsWith("{")) as string;
    expect(JSON.parse(details)).toMatchObject({
      targetUserId: "created-1",
      username: "novo.operador",
      role: "atendente",
    });
  });

  it("cria operador SEM e-mail (operador local) e não consulta unicidade de e-mail", async () => {
    const mock = createMockDb({ newUserId: "created-2" });
    const result = await createArenaUser(makeCreateInput({ email: undefined }), makeCtx(mock));

    expect(result).toEqual({ success: true, userId: "created-2" });
    // não pode existir SELECT de unicidade de e-mail quando e-mail não é informado
    const emailCheck = mock.calls.find((c) => /SELECT id/.test(c.text) && /email = /.test(c.text));
    expect(emailCheck).toBeUndefined();
  });

  it("rejeita username já usado no tenant (username_taken) sem inserir", async () => {
    const mock = createMockDb({ usernameTaken: true });
    const result = await createArenaUser(makeCreateInput(), makeCtx(mock));

    expect(result).toEqual({ success: false, reason: "username_taken" });
    expect(userInsert(mock)).toBeUndefined();
    expect(mock.auditInserts()).toHaveLength(0);
  });

  it("rejeita e-mail já usado no tenant (email_taken) sem inserir", async () => {
    const mock = createMockDb({ emailTaken: true });
    const result = await createArenaUser(makeCreateInput(), makeCtx(mock));

    expect(result).toEqual({ success: false, reason: "email_taken" });
    expect(userInsert(mock)).toBeUndefined();
  });

  it("rejeita senha com menos de 8 caracteres (validation) antes de tocar o banco", async () => {
    const mock = createMockDb();
    const result = await createArenaUser(makeCreateInput({ password: "curta12" }), makeCtx(mock));

    expect(result.success).toBe(false);
    if (result.success) throw new Error("esperava falha");
    expect(result.reason).toBe("validation");
    expect(result.errors?.password).toBeTruthy();
    // nenhuma query é emitida quando a validação falha
    expect(mock.calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC "Edição e Controle de Acesso" — updateArenaUser
// ---------------------------------------------------------------------------

describe("updateArenaUser", () => {
  it("altera módulos e grava audit user.modules_changed com before/after", async () => {
    const mock = createMockDb({ user: makeUserRow({ role: "atendente", modules_allowed: '["pdv"]' }) });
    const result = await updateArenaUser(
      "user-1",
      makeUpdateInput({ role: "atendente", modulesAllowed: ["pdv", "crm"] }),
      makeCtx(mock)
    );

    expect(result).toEqual({ success: true });
    const audit = mock.auditFor("user.modules_changed")!;
    expect(audit).toBeDefined();
    const details = JSON.parse(audit.params.find((p) => typeof p === "string" && p.startsWith("{")) as string);
    expect(details.before.modulesAllowed).toEqual(["pdv"]);
    expect(details.after.modulesAllowed).toEqual(["pdv", "crm"]);
  });

  it("troca o perfil (role) e registra before/after no audit", async () => {
    const mock = createMockDb({ user: makeUserRow({ role: "atendente", modules_allowed: '["pdv"]' }) });
    const result = await updateArenaUser(
      "user-1",
      makeUpdateInput({ role: "gerente", modulesAllowed: ["pdv"] }),
      makeCtx(mock)
    );

    expect(result).toEqual({ success: true });
    // módulos inalterados → ação genérica user.updated, mas ainda audita a troca de role
    const audit = mock.auditFor("user.updated")!;
    expect(audit).toBeDefined();
    const details = JSON.parse(audit.params.find((p) => typeof p === "string" && p.startsWith("{")) as string);
    expect(details.before.role).toBe("atendente");
    expect(details.after.role).toBe("gerente");
  });

  it("bloqueia o rebaixamento do ÚLTIMO admin ativo (last_active_admin)", async () => {
    const mock = createMockDb({
      user: makeUserRow({ role: "admin", status: "active" }),
      otherActiveAdmins: 0,
    });
    const result = await updateArenaUser("user-1", makeUpdateInput({ role: "atendente" }), makeCtx(mock));

    expect(result).toEqual({ success: false, reason: "last_active_admin" });
    expect(userUpdate(mock)).toBeUndefined();
    expect(mock.auditInserts()).toHaveLength(0);
  });

  it("permite rebaixar um admin quando há outro admin ativo", async () => {
    const mock = createMockDb({
      user: makeUserRow({ role: "admin", status: "active" }),
      otherActiveAdmins: 1,
    });
    const result = await updateArenaUser("user-1", makeUpdateInput({ role: "gerente" }), makeCtx(mock));

    expect(result).toEqual({ success: true });
    expect(userUpdate(mock)).toBeDefined();
  });

  it("rejeita e-mail já usado por outro operador (email_taken)", async () => {
    const mock = createMockDb({
      user: makeUserRow({ email: "atual@arena.com" }),
      emailTaken: true,
    });
    const result = await updateArenaUser(
      "user-1",
      makeUpdateInput({ email: "conflito@arena.com" }),
      makeCtx(mock)
    );

    expect(result).toEqual({ success: false, reason: "email_taken" });
    expect(userUpdate(mock)).toBeUndefined();
  });

  it("retorna not_found quando o operador não existe", async () => {
    const mock = createMockDb({ user: null });
    const result = await updateArenaUser("ausente", makeUpdateInput(), makeCtx(mock));
    expect(result).toEqual({ success: false, reason: "not_found" });
  });
});

// ---------------------------------------------------------------------------
// AC "Inativação (não exclusão)" + Autoproteção — deactivateArenaUser
// ---------------------------------------------------------------------------

describe("deactivateArenaUser", () => {
  it("bloqueia a inativação do último admin ativo (autoproteção)", async () => {
    const mock = createMockDb({
      user: makeUserRow({ role: "admin", status: "active" }),
      otherActiveAdmins: 0,
    });
    const result = await deactivateArenaUser("user-1", makeCtx(mock));

    expect(result).toEqual({ success: false, reason: "last_active_admin" });
    expect(userUpdate(mock)).toBeUndefined();
  });

  it("permite inativar um admin quando há outro admin ativo e grava audit user.deactivated", async () => {
    const mock = createMockDb({
      user: makeUserRow({ role: "admin", status: "active" }),
      otherActiveAdmins: 1,
    });
    const result = await deactivateArenaUser("user-1", makeCtx(mock));

    expect(result).toEqual({ success: true });
    expect(userUpdate(mock)!.text).toMatch(/status = 'inactive'/);
    expect(mock.auditFor("user.deactivated")).toBeDefined();
  });

  it("inativa operador não-admin sem checar contagem de admins", async () => {
    const mock = createMockDb({ user: makeUserRow({ role: "atendente", status: "active" }) });
    const result = await deactivateArenaUser("user-1", makeCtx(mock));

    expect(result).toEqual({ success: true });
    const count = mock.calls.find((c) => /COUNT\(\*\)/.test(c.text));
    expect(count).toBeUndefined();
  });

  it("é idempotente quando o operador já está inativo (não emite update nem audit)", async () => {
    const mock = createMockDb({ user: makeUserRow({ status: "inactive" }) });
    const result = await deactivateArenaUser("user-1", makeCtx(mock));

    expect(result).toEqual({ success: true });
    expect(userUpdate(mock)).toBeUndefined();
    expect(mock.auditInserts()).toHaveLength(0);
  });

  it("retorna not_found quando o operador não existe", async () => {
    const mock = createMockDb({ user: null });
    expect(await deactivateArenaUser("x", makeCtx(mock))).toEqual({ success: false, reason: "not_found" });
  });
});

// ---------------------------------------------------------------------------
// reactivateArenaUser
// ---------------------------------------------------------------------------

describe("reactivateArenaUser", () => {
  it("reativa operador inativo e grava audit user.reactivated", async () => {
    const mock = createMockDb({ user: makeUserRow({ status: "inactive" }) });
    const result = await reactivateArenaUser("user-1", makeCtx(mock));

    expect(result).toEqual({ success: true });
    expect(userUpdate(mock)!.text).toMatch(/status = 'active'/);
    expect(mock.auditFor("user.reactivated")).toBeDefined();
  });

  it("é idempotente quando o operador já está ativo", async () => {
    const mock = createMockDb({ user: makeUserRow({ status: "active" }) });
    const result = await reactivateArenaUser("user-1", makeCtx(mock));

    expect(result).toEqual({ success: true });
    expect(userUpdate(mock)).toBeUndefined();
    expect(mock.auditInserts()).toHaveLength(0);
  });

  it("retorna not_found quando o operador não existe", async () => {
    const mock = createMockDb({ user: null });
    expect(await reactivateArenaUser("x", makeCtx(mock))).toEqual({ success: false, reason: "not_found" });
  });
});

// ---------------------------------------------------------------------------
// resetArenaUserPassword — recuperação pelo Admin (operador sem e-mail)
// ---------------------------------------------------------------------------

describe("resetArenaUserPassword", () => {
  it("rejeita senha fraca (< 8) sem tocar o banco (weak_password)", async () => {
    const mock = createMockDb({ user: makeUserRow() });
    const result = await resetArenaUserPassword("user-1", "curta12", makeCtx(mock));

    expect(result).toEqual({ success: false, reason: "weak_password" });
    expect(mock.calls).toHaveLength(0);
  });

  it("redefine a senha, zera lockout e grava audit user.password_reset sem vazar senha/hash", async () => {
    const mock = createMockDb({ user: makeUserRow() });
    const result = await resetArenaUserPassword("user-1", "novaSenhaSegura1", makeCtx(mock), {
      mustChangePassword: true,
    });

    expect(result).toEqual({ success: true });
    const update = userUpdate(mock)!;
    expect(update.text).toMatch(/failed_attempts = 0/);
    expect(update.text).toMatch(/locked_until = NULL/);
    expect(update.params).toContain(HASH_SENTINEL);

    const audit = mock.auditFor("user.password_reset")!;
    expect(audit).toBeDefined();
    const serialized = JSON.stringify(audit.params);
    expect(serialized).not.toContain("novaSenhaSegura1");
    expect(serialized).not.toContain(HASH_SENTINEL);
  });

  it("retorna not_found quando o operador não existe", async () => {
    const mock = createMockDb({ user: null });
    expect(await resetArenaUserPassword("x", "senhaValida1", makeCtx(mock))).toEqual({
      success: false,
      reason: "not_found",
    });
  });
});

// ---------------------------------------------------------------------------
// AC "Listagem" — listArenaUsers / getArenaUser
// ---------------------------------------------------------------------------

describe("listArenaUsers / getArenaUser", () => {
  it("lista operadores mapeando modules_allowed (JSON) e campos", async () => {
    const mock = createMockDb({
      list: [
        makeUserRow({ id: "u1", username: "ana", modules_allowed: '["pdv","crm"]', last_login_at: new Date("2026-01-02T10:00:00Z") }),
        makeUserRow({ id: "u2", username: "bruno", modules_allowed: "[]", status: "inactive", email: null }),
      ],
    });
    const result = await listArenaUsers(makeCtx(mock));

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: "u1",
      username: "ana",
      modulesAllowed: ["pdv", "crm"],
      status: "active",
    });
    expect(result[0].lastLoginAt).toEqual(new Date("2026-01-02T10:00:00Z"));
    expect(result[1]).toMatchObject({ username: "bruno", modulesAllowed: [], status: "inactive", email: null });
  });

  it("getArenaUser mapeia um operador existente", async () => {
    const mock = createMockDb({ user: makeUserRow({ id: "u9", modules_allowed: '["quadras"]' }) });
    const result = await getArenaUser(makeCtx(mock), "u9");
    expect(result).toMatchObject({ id: "u9", modulesAllowed: ["quadras"] });
  });

  it("getArenaUser retorna null quando o operador não existe", async () => {
    const mock = createMockDb({ user: null });
    expect(await getArenaUser(makeCtx(mock), "x")).toBeNull();
  });

  it("mapeia modules_allowed inválido como lista vazia (robustez)", async () => {
    const mock = createMockDb({ user: makeUserRow({ modules_allowed: "nao-e-json" }) });
    const result = await getArenaUser(makeCtx(mock), "user-1");
    expect(result?.modulesAllowed).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC1 — Isolamento de tenant
// ---------------------------------------------------------------------------

describe("Isolamento de tenant (AC1)", () => {
  const TENANT_B = "22222222-2222-2222-2222-222222222222";

  it("as consultas do tenant B filtram tenant_id = B e nunca o do tenant A", async () => {
    const mock = createMockDb({ list: [makeUserRow({ id: "b1", username: "so-do-b" })] });
    const result = await listArenaUsers(makeCtx(mock, TENANT_B));

    expect(result).toHaveLength(1);
    expect(result[0].username).toBe("so-do-b");
    // toda query gerada é escopada por tenant_id = B (parâmetro), nunca por A
    expect(mock.calls.length).toBeGreaterThan(0);
    for (const call of mock.calls) {
      expect(call.text).toMatch(/tenant_id = /);
      expect(call.params).toContain(TENANT_B);
      expect(call.params).not.toContain(TENANT_A);
    }
  });

  it("createArenaUser grava tenant_id da sessão, não de outro tenant", async () => {
    const mock = createMockDb({ newUserId: "b-created" });
    await createArenaUser(makeCreateInput({ email: undefined }), makeCtx(mock, TENANT_B));

    const insert = userInsert(mock)!;
    expect(insert.params).toContain(TENANT_B);
    expect(insert.params).not.toContain(TENANT_A);
  });

  it("rejeita tenant_id fora do padrão UUID (defesa contra injeção)", async () => {
    const mock = createMockDb();
    await expect(listArenaUsers(makeCtx(mock, "public"))).rejects.toThrow(/tenant_id inválido/i);
    await expect(listArenaUsers(makeCtx(mock, "tenant_Arena"))).rejects.toThrow();
  });
});
