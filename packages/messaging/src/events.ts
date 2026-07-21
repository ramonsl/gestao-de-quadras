import IORedis from "ioredis";
import type { WhatsAppConnectionSnapshot } from "./types";

export function statusChannel(tenantId: string): string {
  return `whatsapp:status:${tenantId}`;
}

export interface StatusEventPublisher {
  publish(tenantId: string, snapshot: WhatsAppConnectionSnapshot): Promise<void>;
  close(): Promise<void>;
}

/** Usado por `apps/worker` para publicar cada mudança de status (AC3). */
export function createStatusEventPublisher(redisUrl: string): StatusEventPublisher {
  const client = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  return {
    async publish(tenantId, snapshot) {
      await client.publish(statusChannel(tenantId), JSON.stringify(snapshot));
    },
    async close() {
      await client.quit();
    },
  };
}

export interface StatusEventSubscription {
  unsubscribe(): Promise<void>;
}

/** Usado pela route handler SSE de `apps/web` — uma conexão Redis dedicada por assinante. */
export function subscribeToStatus(
  redisUrl: string,
  tenantId: string,
  onSnapshot: (snapshot: WhatsAppConnectionSnapshot) => void
): StatusEventSubscription {
  const client = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const channel = statusChannel(tenantId);

  client.subscribe(channel).catch(() => {
    // Reconexão do ioredis reassina automaticamente; erro inicial não é fatal aqui.
  });

  client.on("message", (receivedChannel, message) => {
    if (receivedChannel !== channel) return;
    try {
      onSnapshot(JSON.parse(message) as WhatsAppConnectionSnapshot);
    } catch {
      // Payload malformado — ignora; o próximo evento de status corrige o estado exibido.
    }
  });

  return {
    async unsubscribe() {
      await client.unsubscribe(channel);
      await client.quit();
    },
  };
}
