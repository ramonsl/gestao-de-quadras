import {
  createControlQueueProducer,
  createNotificationQueueProducer,
  type WhatsAppControlQueuePort,
  type NotificationQueuePort,
} from "@gestao-de-quadras/messaging";

let controlProducer: WhatsAppControlQueuePort | null = null;
let notificationProducer: NotificationQueuePort | null = null;

function getRedisUrl(): string {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL não configurada. Defina a variável de ambiente antes de iniciar a aplicação.");
  }
  return redisUrl;
}

/** Producer BullMQ compartilhado no processo do Next — reaproveita a conexão Redis entre requests. */
export function getWhatsAppControlQueue(): WhatsAppControlQueuePort {
  if (!controlProducer) {
    controlProducer = createControlQueueProducer(getRedisUrl());
  }
  return controlProducer;
}

/** Producer da fila de notificações (WPP-02 / PDV-06) — reaproveita a conexão Redis entre requests. */
export function getNotificationQueue(): NotificationQueuePort {
  if (!notificationProducer) {
    notificationProducer = createNotificationQueueProducer(getRedisUrl());
  }
  return notificationProducer;
}
