import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { z } from "zod";
import type { MessagingProvider } from "./provider";

export const WHATSAPP_CONTROL_QUEUE = "whatsapp.control";

const uuidSchema = z.string().uuid();

export const whatsappControlJobSchema = z.object({
  type: z.enum(["connect", "disconnect"]),
  tenantId: uuidSchema,
  requestedByUserId: uuidSchema,
});

export type WhatsAppControlJob = z.infer<typeof whatsappControlJobSchema>;

export interface WhatsAppControlQueuePort {
  enqueue(job: WhatsAppControlJob): Promise<void>;
}

/** BullMQ exige `maxRetriesPerRequest: null` na conexão do Worker/Queue. */
function createRedisConnection(redisUrl: string): IORedis {
  return new IORedis(redisUrl, { maxRetriesPerRequest: null });
}

/** Producer usado por `apps/web` (server actions) para enfileirar comandos de conexão. */
export function createControlQueueProducer(redisUrl: string): WhatsAppControlQueuePort {
  const queue = new Queue<WhatsAppControlJob>(WHATSAPP_CONTROL_QUEUE, {
    connection: createRedisConnection(redisUrl),
  });
  return {
    async enqueue(job) {
      const data = whatsappControlJobSchema.parse(job);
      await queue.add(data.type, data, { removeOnComplete: true, removeOnFail: 50 });
    },
  };
}

/** Consumer usado por `apps/worker` — nunca importado por `apps/web`. */
export function createControlQueueWorker(
  redisUrl: string,
  provider: MessagingProvider
): Worker<WhatsAppControlJob> {
  return new Worker<WhatsAppControlJob>(
    WHATSAPP_CONTROL_QUEUE,
    async (job: Job<WhatsAppControlJob>) => {
      const data = whatsappControlJobSchema.parse(job.data);
      if (data.type === "connect") {
        await provider.startConnection({ tenantId: data.tenantId });
      } else {
        await provider.disconnectConnection({ tenantId: data.tenantId });
      }
    },
    { connection: createRedisConnection(redisUrl) }
  );
}
