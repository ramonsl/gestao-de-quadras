import { describe, it, expect, vi } from "vitest";
import { sendWhatsAppDisconnectedAlert } from "./whatsapp-alerts";
import { createFakeArenaDb } from "../../../packages/messaging/src/test/fake-arena-db";
import { getOrCreateConnection, updateConnection } from "../../../packages/messaging/src/state/connection-repository";
import { sqlText } from "../../../packages/core/src/test/sql-mock";
import type { EmailProvider } from "../../../packages/core/src/email/email.provider";
import type { ArenaDb } from "../../../packages/core/src/db/tenant";

const TENANT_A = "11111111-1111-1111-1111-111111111111";

type AdminRow = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: "admin" | "gerente" | "atendente";
  modules_allowed: string;
  status: "active" | "inactive";
  must_change_password: boolean;
  last_login_at: Date | null;
};

function makeAdminRow(overrides: Partial<AdminRow> = {}): AdminRow {
  return {
    id: "admin-1",
    username: "admin",
    name: "Admin Um",
    email: "admin@arena.com",
    phone: null,
    role: "admin",
    modules_allowed: "[]",
    status: "active",
    must_change_password: false,
    last_login_at: null,
    ...overrides,
  };
}

function createFakeDb(opts: { admins?: AdminRow[]; tenantName?: string } = {}) {
  const fake = createFakeArenaDb();
  const execute = async (sqlObj: unknown): Promise<{ rows: unknown[] }> => {
    const text = sqlText(sqlObj);
    if (/FROM users_tenants/.test(text)) {
      return { rows: opts.admins ?? [] };
    }
    if (/FROM tenants WHERE id/.test(text)) {
      return { rows: opts.tenantName ? [{ name: opts.tenantName }] : [] };
    }
    return fake.db.execute(sqlObj);
  };
  return { fake, db: { execute } as unknown as ArenaDb };
}

function makeFakeEmailProvider() {
  const sent: Array<{ to: string; arenaName: string }> = [];
  const provider: EmailProvider = {
    sendActivationEmail: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
    sendWhatsAppDisconnectedAlert: vi.fn(async (params) => {
      sent.push({ to: params.to, arenaName: params.arenaName });
    }),
  };
  return { provider, sent };
}

describe("sendWhatsAppDisconnectedAlert", () => {
  it("envia e-mail a todos os admins ativos com e-mail e marca o dedupe", async () => {
    const { db } = createFakeDb({
      admins: [
        makeAdminRow({ id: "a1", email: "a1@arena.com" }),
        makeAdminRow({ id: "a2", email: "a2@arena.com" }),
      ],
      tenantName: "Arena Central",
    });
    const { provider, sent } = makeFakeEmailProvider();

    await sendWhatsAppDisconnectedAlert(TENANT_A, { db, emailProvider: provider });

    expect(sent).toEqual([
      { to: "a1@arena.com", arenaName: "Arena Central" },
      { to: "a2@arena.com", arenaName: "Arena Central" },
    ]);

    const record = await getOrCreateConnection({ db, tenantId: TENANT_A });
    expect(record.permanentAlertSentAt).not.toBeNull();
  });

  it("ignora gerente/atendente e admins sem e-mail", async () => {
    const { db } = createFakeDb({
      admins: [
        makeAdminRow({ id: "a1", email: null }),
        makeAdminRow({ id: "g1", role: "gerente", email: "gerente@arena.com" }),
        makeAdminRow({ id: "a2", status: "inactive", email: "inativo@arena.com" }),
      ],
    });
    const { provider, sent } = makeFakeEmailProvider();

    await sendWhatsAppDisconnectedAlert(TENANT_A, { db, emailProvider: provider });

    expect(sent).toEqual([]);
  });

  it("não reenvia se o alerta já foi enviado (dedupe)", async () => {
    const { db } = createFakeDb({ admins: [makeAdminRow()] });
    await updateConnection({ db, tenantId: TENANT_A }, { permanentAlertSentAt: new Date() });

    const { provider, sent } = makeFakeEmailProvider();
    await sendWhatsAppDisconnectedAlert(TENANT_A, { db, emailProvider: provider });

    expect(sent).toEqual([]);
  });
});
