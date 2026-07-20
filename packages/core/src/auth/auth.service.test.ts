import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import {
  validateCredentials,
  createActivationToken,
  activateAccount,
  createPasswordResetToken,
  resetPassword,
} from "./auth.service";
import { sqlText, sqlParams, type RecordedCall } from "../test/sql-mock";

// ---------------------------------------------------------------------------
// Tempos fake para testes de expiração de token
// ---------------------------------------------------------------------------

const NOW = new Date("2026-01-01T12:00:00Z");
const FUTURE = new Date(NOW.getTime() + 1000 * 60 * 60 * 24); // +24h
const PAST = new Date(NOW.getTime() - 1000 * 60 * 60 * 24); // -24h

vi.useFakeTimers();
vi.setSystemTime(NOW);
afterAll(() => vi.useRealTimers());

// ---------------------------------------------------------------------------
// Mocks de módulos externos
// ---------------------------------------------------------------------------

vi.mock("@node-rs/argon2", () => ({
  hash: vi.fn().mockResolvedValue("argon2::hashed"),
  verify: vi.fn(),
}));

// crypto.randomBytes é usado para os tokens — mantemos o real (gera hex de 64).

// ---------------------------------------------------------------------------
// Fake de db.execute (o serviço usa db.execute(sql`...`), não o query builder)
// ---------------------------------------------------------------------------

const SCHEMA = "11111111-1111-1111-1111-111111111111"; // tenantId (UUID) da arena de teste

function authMock(selectRow: Record<string, unknown> | null) {
  const calls: RecordedCall[] = [];
  const execute = async (sqlObj: unknown): Promise<{ rows: unknown[] }> => {
    const text = sqlText(sqlObj);
    calls.push({ text, params: sqlParams(sqlObj) });
    if (/^\s*SELECT/i.test(text)) {
      return { rows: selectRow ? [selectRow] : [] };
    }
    return { rows: [] };
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { db: { execute } as any, calls };
}

function updateCall(calls: RecordedCall[]): RecordedCall | undefined {
  return calls.find((c) => /^\s*UPDATE/i.test(c.text));
}

function makeAuthRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "user-1",
    username: "operador",
    email: "operador@arena.com",
    password_hash: "stored-hash",
    role: "atendente",
    modules_allowed: '["pdv","crm"]',
    status: "active",
    must_change_password: false,
    activated_at: new Date("2025-06-01T00:00:00Z"),
    activation_token_expires_at: null,
    reset_token_expires_at: null,
    failed_attempts: 0,
    locked_until: null,
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// AC3 / AC7 — validateCredentials (login por username OU e-mail no tenant)
// ---------------------------------------------------------------------------

describe("validateCredentials", () => {
  it("autentica por username e atualiza last_login_at, retornando role e módulos", async () => {
    const { verify } = await import("@node-rs/argon2");
    vi.mocked(verify).mockResolvedValue(true);
    const { db, calls } = authMock(makeAuthRow());

    const result = await validateCredentials("operador", "senhaCorreta1", SCHEMA, db);

    expect(result).toEqual({
      success: true,
      user: {
        id: "user-1",
        username: "operador",
        role: "atendente",
        modulesAllowed: ["pdv", "crm"],
        mustChangePassword: false,
      },
    });
    // buscou por username (não por e-mail)
    expect(calls[0].text).toMatch(/ username = /);
    // login bem-sucedido registra o último acesso
    expect(updateCall(calls)!.text).toMatch(/last_login_at = now\(\)/);
  });

  it("autentica por e-mail quando o identificador contém @", async () => {
    const { verify } = await import("@node-rs/argon2");
    vi.mocked(verify).mockResolvedValue(true);
    const { db, calls } = authMock(makeAuthRow());

    const result = await validateCredentials("operador@arena.com", "senhaCorreta1", SCHEMA, db);

    expect(result.success).toBe(true);
    expect(calls[0].text).toMatch(/ email = /);
  });

  it("retorna invalid_credentials para identificador inexistente", async () => {
    const { db } = authMock(null);
    const result = await validateCredentials("fantasma", "x", SCHEMA, db);
    expect(result).toEqual({ success: false, reason: "invalid_credentials" });
  });

  it("retorna account_inactive quando o status é inactive", async () => {
    const { db } = authMock(makeAuthRow({ status: "inactive" }));
    const result = await validateCredentials("operador", "senhaCorreta1", SCHEMA, db);
    expect(result).toEqual({ success: false, reason: "account_inactive" });
  });

  it("retorna not_activated quando a conta ainda não foi ativada", async () => {
    const { db } = authMock(makeAuthRow({ activated_at: null }));
    const result = await validateCredentials("operador", "senhaCorreta1", SCHEMA, db);
    expect(result).toEqual({ success: false, reason: "not_activated" });
  });

  it("retorna account_locked quando locked_until está no futuro", async () => {
    const { db } = authMock(makeAuthRow({ locked_until: FUTURE }));
    const result = await validateCredentials("operador", "qualquer", SCHEMA, db);
    expect(result).toEqual({ success: false, reason: "account_locked" });
  });

  it("retorna invalid_credentials e incrementa tentativas após senha errada (< 5)", async () => {
    const { verify } = await import("@node-rs/argon2");
    vi.mocked(verify).mockResolvedValue(false);
    const { db, calls } = authMock(makeAuthRow({ failed_attempts: 2 }));

    const result = await validateCredentials("operador", "errada", SCHEMA, db);

    expect(result).toEqual({ success: false, reason: "invalid_credentials" });
    const update = updateCall(calls)!;
    expect(update.text).toMatch(/failed_attempts =/);
    expect(update.params).toContain(3); // 2 -> 3
  });

  it("bloqueia a conta após a 5ª tentativa falha (account_locked)", async () => {
    const { verify } = await import("@node-rs/argon2");
    vi.mocked(verify).mockResolvedValue(false);
    const { db, calls } = authMock(makeAuthRow({ failed_attempts: 4 }));

    const result = await validateCredentials("operador", "errada", SCHEMA, db);

    expect(result).toEqual({ success: false, reason: "account_locked" });
    const update = updateCall(calls)!;
    expect(update.params).toContain(5); // 4 -> 5
    // grava um locked_until na 5ª falha
    expect(update.text).toMatch(/locked_until =/);
  });

  it("rejeita o schema fora do padrão tenant_* (defesa contra injeção)", async () => {
    const { db } = authMock(makeAuthRow());
    await expect(validateCredentials("operador", "x", "public", db)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Ativação de conta (fluxo por e-mail) — agora com schemaName
// ---------------------------------------------------------------------------

describe("createActivationToken", () => {
  it("gera token hex de 64 chars e persiste (filtrando tenant_id)", async () => {
    const { db, calls } = authMock(null);
    const token = await createActivationToken("user-1", SCHEMA, db);

    expect(token).toHaveLength(64);
    const update = updateCall(calls)!;
    expect(update.text).toMatch(/activation_token =/);
    expect(update.text).toMatch(/UPDATE users_tenants/);
    expect(update.text).toMatch(/tenant_id = /);
  });
});

describe("activateAccount", () => {
  it("ativa a conta com token válido (dentro do prazo)", async () => {
    const { db } = authMock({ id: "user-1", activation_token_expires_at: FUTURE });
    const result = await activateAccount("token-abc", "novaSenhaSegura1", SCHEMA, db);
    expect(result).toEqual({ success: true });
  });

  it("retorna token_expired quando o token expirou", async () => {
    const { db } = authMock({ id: "user-1", activation_token_expires_at: PAST });
    const result = await activateAccount("token-abc", "novaSenhaSegura1", SCHEMA, db);
    expect(result).toEqual({ success: false, reason: "token_expired" });
  });

  it("retorna token_not_found para token inexistente", async () => {
    const { db } = authMock(null);
    const result = await activateAccount("token-invalido", "novaSenhaSegura1", SCHEMA, db);
    expect(result).toEqual({ success: false, reason: "token_not_found" });
  });
});

// ---------------------------------------------------------------------------
// Recuperação de senha por e-mail — agora com schemaName
// ---------------------------------------------------------------------------

describe("createPasswordResetToken", () => {
  it("retorna null para e-mail inexistente (não revela existência)", async () => {
    const { db } = authMock(null);
    expect(await createPasswordResetToken("ninguem@arena.com", SCHEMA, db)).toBeNull();
  });

  it("retorna token hex de 64 chars para e-mail existente", async () => {
    const { db } = authMock({ id: "user-1" });
    const token = await createPasswordResetToken("operador@arena.com", SCHEMA, db);
    expect(token).toHaveLength(64);
  });
});

describe("resetPassword", () => {
  it("redefine a senha com token válido e zera lockout", async () => {
    const { db, calls } = authMock({ id: "user-1", reset_token_expires_at: FUTURE });
    const result = await resetPassword("reset-token", "novaSenhaSegura1", SCHEMA, db);

    expect(result).toEqual({ success: true });
    expect(updateCall(calls)!.text).toMatch(/failed_attempts = 0/);
  });

  it("retorna token_expired quando o token expirou", async () => {
    const { db } = authMock({ id: "user-1", reset_token_expires_at: PAST });
    expect(await resetPassword("reset-token", "novaSenhaSegura1", SCHEMA, db)).toEqual({
      success: false,
      reason: "token_expired",
    });
  });

  it("retorna token_not_found para token inexistente", async () => {
    const { db } = authMock(null);
    expect(await resetPassword("invalido", "novaSenhaSegura1", SCHEMA, db)).toEqual({
      success: false,
      reason: "token_not_found",
    });
  });
});
