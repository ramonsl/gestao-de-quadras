import makeWASocket, {
  DisconnectReason,
  type ConnectionState,
  type WASocket,
} from "@whiskeysockets/baileys";
import type { Boom } from "@hapi/boom";
import type { TenantRef } from "../db-types";
import { usePostgresAuthState, clearAuthState } from "./auth-state-store";
import { getOrCreateConnection, updateConnection, toSnapshot } from "../state/connection-repository";
import type { WhatsAppConnectionSnapshot } from "../types";

export interface SessionPoolEvent {
  tenantId: string;
  snapshot: WhatsAppConnectionSnapshot;
  permanentDisconnect?: boolean;
}

export type SessionPoolEventHandler = (event: SessionPoolEvent) => void;

/** Fábrica de socket injetável — permite testar o pool sem abrir conexão real com o WhatsApp. */
export type SocketFactory = (params: {
  auth: Awaited<ReturnType<typeof usePostgresAuthState>>["state"];
}) => WASocket;

const defaultSocketFactory: SocketFactory = ({ auth }) => makeWASocket({ auth });

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Backoff progressivo (1s, 2s, 4s, ... teto de 30s) — sem limite de tentativas. */
function backoffDelayMs(attempt: number): number {
  return Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5));
}

interface ActiveSession {
  socket: WASocket;
}

/**
 * Pool assíncrono centralizado, no mesmo processo do Worker (AC2). Uma sessão
 * Baileys por tenant, idempotente (conectar 2x não abre 2 sockets).
 */
export class WhatsAppSessionPool {
  private readonly sessions = new Map<string, ActiveSession>();
  private readonly listeners = new Set<SessionPoolEventHandler>();

  constructor(private readonly createSocket: SocketFactory = defaultSocketFactory) {}

  onEvent(handler: SessionPoolEventHandler): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  private emit(event: SessionPoolEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  /** Retoma, no boot do worker, as arenas cuja sessão estava ativa antes do restart/deploy. */
  async bootstrap(refs: TenantRef[]): Promise<void> {
    for (const ref of refs) {
      const record = await getOrCreateConnection(ref);
      if (["connected", "connecting", "qr_pending"].includes(record.status)) {
        await this.connect(ref);
      }
    }
  }

  async connect(ref: TenantRef): Promise<void> {
    if (this.sessions.has(ref.tenantId)) return;

    const { state, saveCreds } = await usePostgresAuthState(ref);
    const connecting = await updateConnection(ref, { status: "connecting" });
    this.emit({ tenantId: ref.tenantId, snapshot: toSnapshot(connecting) });

    const socket = this.createSocket({ auth: state });
    this.sessions.set(ref.tenantId, { socket });

    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", (update) => {
      void this.handleConnectionUpdate(ref, update);
    });
  }

  private async handleConnectionUpdate(
    ref: TenantRef,
    update: Partial<ConnectionState>
  ): Promise<void> {
    if (update.qr) {
      const record = await updateConnection(ref, {
        status: "qr_pending",
        qrCode: update.qr,
        qrGeneratedAt: new Date(),
      });
      this.emit({ tenantId: ref.tenantId, snapshot: toSnapshot(record) });
      return;
    }

    if (update.connection === "open") {
      const phoneNumber = this.sessions.get(ref.tenantId)?.socket.user?.id?.split(":")[0] ?? null;
      const record = await updateConnection(ref, {
        status: "connected",
        qrCode: null,
        phoneNumber,
        connectedAt: new Date(),
        reconnectAttempts: 0,
        permanentAlertSentAt: null,
      });
      this.emit({ tenantId: ref.tenantId, snapshot: toSnapshot(record) });
      return;
    }

    if (update.connection === "close") {
      const statusCode = (update.lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      this.sessions.delete(ref.tenantId);

      if (isLoggedOut) {
        await clearAuthState(ref);
        const record = await updateConnection(ref, {
          status: "disconnected_permanent",
          qrCode: null,
          lastDisconnectedAt: new Date(),
          disconnectReason: "logged_out",
        });
        this.emit({ tenantId: ref.tenantId, snapshot: toSnapshot(record), permanentDisconnect: true });
        return;
      }

      // Queda transitória (internet do chip) — reconecta reaproveitando as mesmas credenciais (AC4).
      const current = await getOrCreateConnection(ref);
      const attempt = current.reconnectAttempts + 1;
      const record = await updateConnection(ref, {
        status: "connecting",
        lastDisconnectedAt: new Date(),
        disconnectReason: "transient",
        reconnectAttempts: attempt,
      });
      this.emit({ tenantId: ref.tenantId, snapshot: toSnapshot(record) });

      await sleep(backoffDelayMs(attempt));
      await this.connect(ref);
    }
  }

  /** Desconexão manual pelo Admin — logout explícito e limpeza das credenciais. */
  async disconnect(ref: TenantRef): Promise<void> {
    const session = this.sessions.get(ref.tenantId);
    this.sessions.delete(ref.tenantId);
    if (session) {
      await session.socket.logout().catch(() => {
        // Best-effort: mesmo se o logout remoto falhar, o estado local é limpo abaixo.
      });
    }
    await clearAuthState(ref);
    const record = await updateConnection(ref, {
      status: "disconnected",
      qrCode: null,
      phoneNumber: null,
      lastDisconnectedAt: new Date(),
      disconnectReason: "admin_disconnect",
    });
    this.emit({ tenantId: ref.tenantId, snapshot: toSnapshot(record) });
  }

  async getStatus(ref: TenantRef): Promise<WhatsAppConnectionSnapshot> {
    const record = await getOrCreateConnection(ref);
    return toSnapshot(record);
  }
}
