import { createControlQueueProducer, type WhatsAppControlQueuePort } from "@gestao-de-quadras/messaging";

let producer: WhatsAppControlQueuePort | null = null;

/** Producer BullMQ compartilhado no processo do Next — reaproveita a conexão Redis entre requests. */
export function getWhatsAppControlQueue(): WhatsAppControlQueuePort {
  if (!producer) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error(
        "REDIS_URL não configurada. Defina a variável de ambiente antes de iniciar a aplicação."
      );
    }
    producer = createControlQueueProducer(redisUrl);
  }
  return producer;
}
