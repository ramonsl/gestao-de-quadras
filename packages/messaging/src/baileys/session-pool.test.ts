import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Boom } from "@hapi/boom";
import { DisconnectReason, type ConnectionState } from "@whiskeysockets/baileys";
import { WhatsAppSessionPool, type SocketFactory, type VersionFetcher } from "./session-pool";
import { createFakeArenaDb } from "../test/fake-arena-db";

const TENANT_A = "11111111-1111-1111-1111-111111111111";

/** Nunca bate na rede real — fetchLatestBaileysVersion() não roda em testes unitários. */
const noNetworkVersionFetcher: VersionFetcher = async () => undefined;

/** Socket falso mínimo — suficiente para exercitar o pool sem Baileys/rede real. */
function createFakeSocket() {
  const handlers = new Map<string, (payload: unknown) => void>();
  return {
    user: undefined as { id: string } | undefined,
    ev: {
      on: (event: string, handler: (payload: unknown) => void) => {
        handlers.set(event, handler);
      },
    },
    logout: vi.fn().mockResolvedValue(undefined),
    emitConnectionUpdate(update: Partial<ConnectionState>) {
      handlers.get("connection.update")?.(update);
    },
  };
}
type FakeSocket = ReturnType<typeof createFakeSocket>;

function loggedOutError(): Boom {
  return new Boom("logged out", { statusCode: DisconnectReason.loggedOut });
}

function transientError(): Boom {
  return new Boom("connection lost", { statusCode: DisconnectReason.connectionLost });
}

describe("WhatsAppSessionPool", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("connect() marca connecting e depois qr_pending ao receber o QR (AC1/AC3)", async () => {
    const fake = createFakeArenaDb();
    const sockets: FakeSocket[] = [];
    const factory: SocketFactory = () => {
      const s = createFakeSocket();
      sockets.push(s);
      return s as unknown as ReturnType<SocketFactory>;
    };
    const pool = new WhatsAppSessionPool(factory, noNetworkVersionFetcher);
    const events: string[] = [];
    pool.onEvent((e) => events.push(e.snapshot.status));

    await pool.connect({ db: fake.db, tenantId: TENANT_A });
    expect(events).toEqual(["connecting"]);

    sockets[0].emitConnectionUpdate({ qr: "fake-qr-payload" });
    await vi.waitFor(() => expect(events).toContain("qr_pending"));

    const record = fake.connections.get(TENANT_A);
    expect(record?.status).toBe("qr_pending");
    expect(record?.qr_code).toBe("fake-qr-payload");
  });

  it("connect() é idempotente — não abre 2 sockets para o mesmo tenant", async () => {
    const fake = createFakeArenaDb();
    const factory: SocketFactory = vi.fn(() => createFakeSocket() as unknown as ReturnType<SocketFactory>);
    const pool = new WhatsAppSessionPool(factory, noNetworkVersionFetcher);

    await pool.connect({ db: fake.db, tenantId: TENANT_A });
    await pool.connect({ db: fake.db, tenantId: TENANT_A });

    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("connection open marca connected e extrai o telefone do user.id (AC3)", async () => {
    const fake = createFakeArenaDb();
    let socket: FakeSocket | undefined;
    const factory: SocketFactory = () => {
      socket = createFakeSocket();
      socket.user = { id: "5511999999999:12@s.whatsapp.net" };
      return socket as unknown as ReturnType<SocketFactory>;
    };
    const pool = new WhatsAppSessionPool(factory, noNetworkVersionFetcher);

    await pool.connect({ db: fake.db, tenantId: TENANT_A });
    socket!.emitConnectionUpdate({ connection: "open" });
    await vi.waitFor(() => {
      expect(fake.connections.get(TENANT_A)?.status).toBe("connected");
    });

    const record = fake.connections.get(TENANT_A);
    expect(record?.phone_number).toBe("5511999999999");
    expect(record?.reconnect_attempts).toBe(0);
  });

  it("queda transitória reconecta com backoff, incrementando reconnect_attempts (AC4)", async () => {
    const fake = createFakeArenaDb();
    const sockets: FakeSocket[] = [];
    const factory: SocketFactory = () => {
      const s = createFakeSocket();
      sockets.push(s);
      return s as unknown as ReturnType<SocketFactory>;
    };
    const pool = new WhatsAppSessionPool(factory, noNetworkVersionFetcher);

    await pool.connect({ db: fake.db, tenantId: TENANT_A });
    sockets[0].emitConnectionUpdate({ connection: "close", lastDisconnect: { error: transientError(), date: new Date() } });

    await vi.waitFor(() => {
      expect(fake.connections.get(TENANT_A)?.reconnect_attempts).toBe(1);
    });
    expect(fake.connections.get(TENANT_A)?.status).toBe("connecting");
    expect(sockets).toHaveLength(1); // ainda não reconectou — aguardando o backoff

    await vi.advanceTimersByTimeAsync(2_000);
    await vi.waitFor(() => expect(sockets).toHaveLength(2));
  });

  it("não reconecta 'fantasma' se o Admin desconectar durante o backoff de uma queda transitória", async () => {
    const fake = createFakeArenaDb();
    const sockets: FakeSocket[] = [];
    const factory: SocketFactory = () => {
      const s = createFakeSocket();
      sockets.push(s);
      return s as unknown as ReturnType<SocketFactory>;
    };
    const pool = new WhatsAppSessionPool(factory, noNetworkVersionFetcher);

    await pool.connect({ db: fake.db, tenantId: TENANT_A });
    fake.creds.set(TENANT_A, '{"registered":true}');
    sockets[0].emitConnectionUpdate({ connection: "close", lastDisconnect: { error: transientError(), date: new Date() } });

    await vi.waitFor(() => {
      expect(fake.connections.get(TENANT_A)?.status).toBe("connecting");
    });
    expect(sockets).toHaveLength(1); // aguardando o backoff (2s)

    // Admin desconecta manualmente enquanto o retry ainda está agendado.
    await pool.disconnect({ db: fake.db, tenantId: TENANT_A });
    expect(fake.connections.get(TENANT_A)?.status).toBe("disconnected");
    expect(fake.creds.has(TENANT_A)).toBe(false);

    // O retry agendado antes do disconnect não deve abrir um novo socket
    // nem sobrescrever o status "disconnected" escolhido pelo Admin.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(sockets).toHaveLength(1);
    expect(fake.connections.get(TENANT_A)?.status).toBe("disconnected");
  });

  it("logout permanente marca disconnected_permanent, limpa credenciais e emite permanentDisconnect (AC4)", async () => {
    const fake = createFakeArenaDb();
    const sockets: FakeSocket[] = [];
    const factory: SocketFactory = () => {
      const s = createFakeSocket();
      sockets.push(s);
      return s as unknown as ReturnType<SocketFactory>;
    };
    const pool = new WhatsAppSessionPool(factory, noNetworkVersionFetcher);
    const permanentEvents: string[] = [];
    pool.onEvent((e) => {
      if (e.permanentDisconnect) permanentEvents.push(e.tenantId);
    });

    await pool.connect({ db: fake.db, tenantId: TENANT_A });
    fake.creds.set(TENANT_A, '{"registered":true}');

    sockets[0].emitConnectionUpdate({ connection: "close", lastDisconnect: { error: loggedOutError(), date: new Date() } });

    await vi.waitFor(() => {
      expect(fake.connections.get(TENANT_A)?.status).toBe("disconnected_permanent");
    });
    expect(permanentEvents).toEqual([TENANT_A]);
    expect(fake.creds.has(TENANT_A)).toBe(false);

    // Não deve tentar reconectar sozinho — nenhum novo socket é criado.
    await vi.advanceTimersByTimeAsync(35_000);
    expect(sockets).toHaveLength(1);
  });

  it("disconnect() faz logout explícito e limpa o estado (desconexão manual do Admin)", async () => {
    const fake = createFakeArenaDb();
    const socket = createFakeSocket();
    const factory: SocketFactory = () => socket as unknown as ReturnType<SocketFactory>;
    const pool = new WhatsAppSessionPool(factory, noNetworkVersionFetcher);

    await pool.connect({ db: fake.db, tenantId: TENANT_A });
    fake.creds.set(TENANT_A, '{"registered":true}');

    await pool.disconnect({ db: fake.db, tenantId: TENANT_A });

    expect(socket.logout).toHaveBeenCalledTimes(1);
    expect(fake.connections.get(TENANT_A)?.status).toBe("disconnected");
    expect(fake.creds.has(TENANT_A)).toBe(false);
  });

  it("bootstrap() só retoma tenants com status elegível (connected/connecting/qr_pending)", async () => {
    const fake = createFakeArenaDb();
    const factory: SocketFactory = vi.fn(() => createFakeSocket() as unknown as ReturnType<SocketFactory>);
    const pool = new WhatsAppSessionPool(factory, noNetworkVersionFetcher);

    const TENANT_ELIGIBLE = "33333333-3333-3333-3333-333333333333";
    const TENANT_SKIPPED = "44444444-4444-4444-4444-444444444444";

    fake.connections.set(TENANT_ELIGIBLE, {
      id: "conn-x",
      tenant_id: TENANT_ELIGIBLE,
      status: "connected",
      phone_number: "+5511999999999",
      qr_code: null,
      qr_generated_at: null,
      connected_at: new Date(),
      last_disconnected_at: null,
      disconnect_reason: null,
      reconnect_attempts: 0,
      permanent_alert_sent_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    fake.connections.set(TENANT_SKIPPED, {
      id: "conn-y",
      tenant_id: TENANT_SKIPPED,
      status: "disconnected",
      phone_number: null,
      qr_code: null,
      qr_generated_at: null,
      connected_at: null,
      last_disconnected_at: null,
      disconnect_reason: null,
      reconnect_attempts: 0,
      permanent_alert_sent_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await pool.bootstrap([
      { db: fake.db, tenantId: TENANT_ELIGIBLE },
      { db: fake.db, tenantId: TENANT_SKIPPED },
    ]);

    expect(factory).toHaveBeenCalledTimes(1);
  });
});
