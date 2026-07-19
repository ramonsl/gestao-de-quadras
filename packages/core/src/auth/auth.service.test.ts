import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateCredentials,
  createActivationToken,
  activateAccount,
  createPasswordResetToken,
  resetPassword,
  type AuthDb,
} from "./auth.service";

// ---------------------------------------------------------------------------
// Tempos fake para testes de expiração
// ---------------------------------------------------------------------------

const NOW = new Date("2025-01-01T12:00:00Z");
const FUTURE = new Date(NOW.getTime() + 1000 * 60 * 60 * 24); // +24h
const PAST = new Date(NOW.getTime() - 1000 * 60 * 60 * 24);   // -24h

vi.useFakeTimers();
vi.setSystemTime(NOW);

// ---------------------------------------------------------------------------
// Mocks de módulos externos
// ---------------------------------------------------------------------------

vi.mock("@node-rs/argon2", () => ({
  hash: vi.fn().mockResolvedValue("hashed_new_password"),
  verify: vi.fn(),
}));

vi.mock("@gestao-de-quadras/db/schema", () => ({
  users: { id: "id", email: "email" },
}));

// ---------------------------------------------------------------------------
// Helpers de mock do Drizzle
// ---------------------------------------------------------------------------

function buildSelectDb(rows: unknown[], rows2?: unknown[]) {
  let callCount = 0;
  const limit = vi.fn().mockImplementation(() => {
    const result = callCount === 0 ? (Array.isArray(rows) ? rows : []) : (rows2 ?? rows);
    callCount++;
    return Promise.resolve(result);
  });
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  const update = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  });
  return { select, update } as unknown as AuthDb;
}

// ---------------------------------------------------------------------------
// validateCredentials
// ---------------------------------------------------------------------------

describe("validateCredentials", () => {
  const baseUser = {
    id: "user-1",
    email: "operador@arena.com",
    passwordHash: "hashed",
    activatedAt: new Date("2024-01-01"),
    lockedUntil: null,
    failedAttempts: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna success quando credenciais estão corretas", async () => {
    const { verify } = await import("@node-rs/argon2");
    vi.mocked(verify).mockResolvedValue(true);
    const db = buildSelectDb([baseUser]);

    const result = await validateCredentials("operador@arena.com", "senha123", db);
    expect(result).toEqual({ success: true, userId: "user-1" });
  });

  it("retorna invalid_credentials quando usuário não existe", async () => {
    const db = buildSelectDb([]);
    const result = await validateCredentials("inexistente@arena.com", "senha", db);
    expect(result).toEqual({ success: false, reason: "invalid_credentials" });
  });

  it("retorna account_inactive quando conta não foi ativada", async () => {
    const { verify } = await import("@node-rs/argon2");
    vi.mocked(verify).mockResolvedValue(true);
    const db = buildSelectDb([{ ...baseUser, activatedAt: null }]);

    const result = await validateCredentials("operador@arena.com", "senha123", db);
    expect(result).toEqual({ success: false, reason: "account_inactive" });
  });

  it("retorna account_locked quando lockedUntil está no futuro", async () => {
    const db = buildSelectDb([{ ...baseUser, lockedUntil: FUTURE }]);
    const result = await validateCredentials("operador@arena.com", "senha", db);
    expect(result).toEqual({ success: false, reason: "account_locked" });
  });

  it("retorna invalid_credentials após senha errada (tentativas < 5)", async () => {
    const { verify } = await import("@node-rs/argon2");
    vi.mocked(verify).mockResolvedValue(false);
    const db = buildSelectDb([{ ...baseUser, failedAttempts: 2 }]);

    const result = await validateCredentials("operador@arena.com", "errada", db);
    expect(result).toEqual({ success: false, reason: "invalid_credentials" });
  });

  it("bloqueia a conta após 5 tentativas falhas", async () => {
    const { verify } = await import("@node-rs/argon2");
    vi.mocked(verify).mockResolvedValue(false);

    const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
    const limit = vi.fn().mockResolvedValue([{ ...baseUser, failedAttempts: 4 }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select, update: mockUpdate } as unknown as AuthDb;

    const result = await validateCredentials("operador@arena.com", "errada", db);

    expect(result).toEqual({ success: false, reason: "account_locked" });
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ failedAttempts: 5, lockedUntil: expect.any(Date) })
    );
  });
});

// ---------------------------------------------------------------------------
// activateAccount
// ---------------------------------------------------------------------------

describe("activateAccount", () => {
  const validToken = "valid-token-abc123";

  beforeEach(() => vi.clearAllMocks());

  it("ativa a conta com token válido", async () => {
    const db = buildSelectDb(
      [{ id: "user-1", activationToken: validToken, activationTokenExpiresAt: FUTURE }],
      []
    );
    const result = await activateAccount(validToken, "novaSenha123!", db);
    expect(result).toEqual({ success: true });
  });

  it("retorna token_expired quando expirado", async () => {
    const db = buildSelectDb(
      [],
      [{ activationTokenExpiresAt: PAST }]
    );
    const result = await activateAccount(validToken, "novaSenha", db);
    expect(result).toEqual({ success: false, reason: "token_expired" });
  });

  it("retorna token_not_found para token inexistente", async () => {
    const db = buildSelectDb([], []);
    const result = await activateAccount("token-invalido", "novaSenha", db);
    expect(result).toEqual({ success: false, reason: "token_not_found" });
  });
});

// ---------------------------------------------------------------------------
// resetPassword
// ---------------------------------------------------------------------------

describe("resetPassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redefine a senha com token válido", async () => {
    const db = buildSelectDb(
      [{ id: "user-1", resetToken: "token", resetTokenExpiresAt: FUTURE }],
      []
    );
    const result = await resetPassword("token", "novaSenha123!", db);
    expect(result).toEqual({ success: true });
  });

  it("retorna token_expired para token vencido", async () => {
    const db = buildSelectDb([], [{ resetTokenExpiresAt: PAST }]);
    const result = await resetPassword("token", "novaSenha", db);
    expect(result).toEqual({ success: false, reason: "token_expired" });
  });

  it("retorna token_not_found para token inexistente", async () => {
    const db = buildSelectDb([], []);
    const result = await resetPassword("invalido", "novaSenha", db);
    expect(result).toEqual({ success: false, reason: "token_not_found" });
  });
});

// ---------------------------------------------------------------------------
// createPasswordResetToken
// ---------------------------------------------------------------------------

describe("createPasswordResetToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna null para e-mail inexistente", async () => {
    const db = buildSelectDb([]);
    const result = await createPasswordResetToken("inexistente@arena.com", db);
    expect(result).toBeNull();
  });

  it("retorna token hexadecimal para e-mail válido", async () => {
    const db = buildSelectDb([{ id: "user-1" }]);
    const result = await createPasswordResetToken("operador@arena.com", db);
    expect(result).toBeTypeOf("string");
    expect(result).toHaveLength(64); // 32 bytes em hex
  });
});
