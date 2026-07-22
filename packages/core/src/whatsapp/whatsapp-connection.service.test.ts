import { describe, it, expect } from "vitest";
import {
  getWhatsAppConnectionStatus,
  requestWhatsAppConnect,
  requestWhatsAppDisconnect,
  type WhatsAppConnectionContext,
  type WhatsAppControlJob,
  type WhatsAppConnectionStatus,
} from "./whatsapp-connection.service";
import { sqlText, sqlParams, type RecordedCall } from "../test/sql-mock";

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const ADMIN_ACTOR = "admin-actor-id";

interface Scenario {
  connectionStatus?: WhatsAppConnectionStatus | null; // null = linha não existe ainda
}

function makeMockDb(scenario: Scenario = {}) {
  const calls: RecordedCall[] = [];

  const execute = async (sqlObj: unknown): Promise<{ rows: unknown[] }> => {
    const text = sqlText(sqlObj);
    const params = sqlParams(sqlObj);
    calls.push({ text, params });

    const isConnectionSelect = /^\s*SELECT/i.test(text) && /whatsapp_connections/.test(text);
    if (isConnectionSelect) {
      if (scenario.connectionStatus === null || scenario.connectionStatus === undefined) {
        return { rows: [] };
      }
      return {
        rows: [
          {
            status: scenario.connectionStatus,
            qr_code: null,
            phone_number: null,
            connected_at: null,
            last_disconnected_at: null,
            reconnect_attempts: 0,
            updated_at: new Date("2026-01-01T00:00:00Z"),
          },
        ],
      };
    }

    return { rows: [] };
  };

  return {
    db: { execute } as unknown as WhatsAppConnectionContext["db"],
    calls,
    auditFor: (action: string) =>
      calls.find(
        (c) => /INSERT INTO/i.test(c.text) && /audit_logs/.test(c.text) && c.params.some((p) => p === action)
      ),
  };
}

function makeCtx(db: WhatsAppConnectionContext["db"], tenantId = TENANT_A): WhatsAppConnectionContext {
  return { db, tenantId, actorUserId: ADMIN_ACTOR };
}

function makeFakeQueue() {
  const enqueued: WhatsAppControlJob[] = [];
  return {
    enqueued,
    port: { enqueue: async (job: WhatsAppControlJob) => void enqueued.push(job) },
  };
}

describe("getWhatsAppConnectionStatus", () => {
  it("retorna disconnected quando a linha ainda não existe (AC3)", async () => {
    const mock = makeMockDb({ connectionStatus: null });
    const result = await getWhatsAppConnectionStatus(makeCtx(mock.db));
    expect(result.status).toBe("disconnected");
  });

  it("retorna o status persistido", async () => {
    const mock = makeMockDb({ connectionStatus: "qr_pending" });
    const result = await getWhatsAppConnectionStatus(makeCtx(mock.db));
    expect(result.status).toBe("qr_pending");
  });

  it("rejeita tenantId malformado", async () => {
    const mock = makeMockDb();
    await expect(getWhatsAppConnectionStatus(makeCtx(mock.db, "not-a-uuid"))).rejects.toThrow();
  });

  it("converte updated_at para Date mesmo quando o driver devolve string (neon-http via db.execute cru)", async () => {
    // `db.execute(sql...)` sem schema tipado devolve timestamps como string
    // (ex.: "2026-01-01 00:00:00.123456"), não como Date — reproduz esse formato.
    const db = {
      execute: async () => ({
        rows: [
          {
            status: "connected",
            qr_code: null,
            phone_number: "+5511999999999",
            connected_at: "2026-01-01 00:00:00.123456",
            last_disconnected_at: null,
            reconnect_attempts: 0,
            updated_at: "2026-01-02 10:30:00.654321",
          },
        ],
      }),
    } as unknown as WhatsAppConnectionContext["db"];

    const result = await getWhatsAppConnectionStatus(makeCtx(db));

    expect(result.updatedAt).toBeInstanceOf(Date);
    expect(result.updatedAt.toISOString()).toBe("2026-01-02T10:30:00.654Z");
    expect(result.connectedAt).toBeInstanceOf(Date);
  });
});

describe("requestWhatsAppConnect", () => {
  it("enfileira connect e grava auditoria quando desconectado", async () => {
    const mock = makeMockDb({ connectionStatus: "disconnected" });
    const queue = makeFakeQueue();

    const result = await requestWhatsAppConnect(makeCtx(mock.db), queue.port);

    expect(result).toEqual({ success: true });
    expect(queue.enqueued).toEqual([
      { type: "connect", tenantId: TENANT_A, requestedByUserId: ADMIN_ACTOR },
    ]);
    expect(mock.auditFor("whatsapp.connection.requested")).toBeDefined();
  });

  it("enfileira connect quando a linha ainda não existe (primeira conexão)", async () => {
    const mock = makeMockDb({ connectionStatus: null });
    const queue = makeFakeQueue();

    const result = await requestWhatsAppConnect(makeCtx(mock.db), queue.port);

    expect(result).toEqual({ success: true });
    expect(queue.enqueued).toHaveLength(1);
  });

  it("recusa duplo enqueue quando já conectado", async () => {
    const mock = makeMockDb({ connectionStatus: "connected" });
    const queue = makeFakeQueue();

    const result = await requestWhatsAppConnect(makeCtx(mock.db), queue.port);

    expect(result).toEqual({ success: false, reason: "already_connected" });
    expect(queue.enqueued).toHaveLength(0);
  });

  it.each(["connecting", "qr_pending"] as const)(
    "recusa duplo enqueue quando status é %s",
    async (status) => {
      const mock = makeMockDb({ connectionStatus: status });
      const queue = makeFakeQueue();

      const result = await requestWhatsAppConnect(makeCtx(mock.db), queue.port);

      expect(result).toEqual({ success: false, reason: "already_connecting" });
      expect(queue.enqueued).toHaveLength(0);
    }
  );
});

describe("requestWhatsAppDisconnect", () => {
  it("enfileira disconnect e grava auditoria quando conectado", async () => {
    const mock = makeMockDb({ connectionStatus: "connected" });
    const queue = makeFakeQueue();

    const result = await requestWhatsAppDisconnect(makeCtx(mock.db), queue.port);

    expect(result).toEqual({ success: true });
    expect(queue.enqueued).toEqual([
      { type: "disconnect", tenantId: TENANT_A, requestedByUserId: ADMIN_ACTOR },
    ]);
    expect(mock.auditFor("whatsapp.connection.disconnected_by_admin")).toBeDefined();
  });

  it("recusa quando já desconectado", async () => {
    const mock = makeMockDb({ connectionStatus: "disconnected" });
    const queue = makeFakeQueue();

    const result = await requestWhatsAppDisconnect(makeCtx(mock.db), queue.port);

    expect(result).toEqual({ success: false, reason: "not_connected" });
    expect(queue.enqueued).toHaveLength(0);
  });

  it("recusa quando a linha ainda não existe", async () => {
    const mock = makeMockDb({ connectionStatus: null });
    const queue = makeFakeQueue();

    const result = await requestWhatsAppDisconnect(makeCtx(mock.db), queue.port);

    expect(result).toEqual({ success: false, reason: "not_connected" });
  });

  it("recusa quando desconectado permanentemente", async () => {
    const mock = makeMockDb({ connectionStatus: "disconnected_permanent" });
    const queue = makeFakeQueue();

    const result = await requestWhatsAppDisconnect(makeCtx(mock.db), queue.port);

    expect(result).toEqual({ success: false, reason: "not_connected" });
  });
});
