import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { z } from "zod";

export const NOTIFICATION_QUEUE = "notification.queue";

const uuidSchema = z.string().uuid();

// ---------------------------------------------------------------------------
// Schemas de jobs
// ---------------------------------------------------------------------------

/**
 * WPP-02: notificação de lançamento na comanda.
 * O worker busca os itens frescos ao processar — não serializa itens no job.
 */
export const ComandaNotificationJobSchema = z.object({
  type: z.literal("comanda_notification"),
  tenantId: uuidSchema,
  comandaId: uuidSchema,
  /** arena-scoped customer id (customers.id) */
  customerId: uuidSchema,
  toE164: z.string().min(10).max(20),
});

/**
 * WPP-03/05 e PDV-06: texto avulso.
 * `customerId` = arena-scoped (customers.id) — obrigatório para WPP.
 * `globalCustomerId` = global (global_customers.id) — legado PDV-06.
 * Ao menos um dos dois deve ser fornecido; o worker valida em runtime.
 */
export const TextMessageJobSchema = z
  .object({
    type: z.literal("text_message"),
    tenantId: uuidSchema,
    /** arena-scoped (customers.id) — para WPP-03/05 */
    customerId: uuidSchema.optional(),
    /** global (global_customers.id) — legado PDV-06 */
    globalCustomerId: uuidSchema.optional(),
    /** comanda de origem, quando aplicável */
    comandaId: uuidSchema.optional().nullable(),
    toE164: z.string().min(10).max(20),
    bodyText: z.string().min(1).max(4096),
  })
  .refine(
    (d) => d.customerId !== undefined || d.globalCustomerId !== undefined,
    { message: "customerId ou globalCustomerId é obrigatório" }
  );

// z.union (não discriminatedUnion) porque TextMessageJobSchema usa .refine() → ZodEffects
export const NotificationJobSchema = z.union([
  ComandaNotificationJobSchema,
  TextMessageJobSchema,
]);

export type ComandaNotificationJob = z.infer<typeof ComandaNotificationJobSchema>;
export type TextMessageJob = z.infer<typeof TextMessageJobSchema>;
export type NotificationJob = z.infer<typeof NotificationJobSchema>;

// ---------------------------------------------------------------------------
// Porta sem dependência de BullMQ — usada por packages/core e apps/web
// ---------------------------------------------------------------------------

export interface NotificationQueuePort {
  /** WPP-02: enfileira notificação de comanda com anti-spam de 3 min. */
  enqueueComandaNotification(input: Omit<ComandaNotificationJob, "type">): Promise<void>;
  /** WPP-03/05 e PDV-06: enfileira texto avulso. */
  enqueueTextMessage(input: Omit<TextMessageJob, "type">): Promise<void>;
}

// ---------------------------------------------------------------------------
// Implementações BullMQ
// ---------------------------------------------------------------------------

function createRedisConnection(redisUrl: string): IORedis {
  return new IORedis(redisUrl, { maxRetriesPerRequest: null });
}

const COMANDA_NOTIFICATION_DELAY_MS = 3 * 60 * 1_000; // 3 min (WPP-02 anti-spam)

/**
 * Producer usado por apps/web (server actions) e apps/worker.
 * Seguro para importar no processo Next.js — sem worker BullMQ.
 */
export function createNotificationQueueProducer(redisUrl: string): NotificationQueuePort {
  const queue = new Queue<NotificationJob>(NOTIFICATION_QUEUE, {
    connection: createRedisConnection(redisUrl),
    defaultJobOptions: { removeOnComplete: true, removeOnFail: 100 },
  });

  return {
    async enqueueComandaNotification(input) {
      const data = ComandaNotificationJobSchema.parse({ type: "comanda_notification", ...input });
      const jobId = `wpp-notify:${data.tenantId}:${data.comandaId}`;

      // WPP-02: reinicia o timer se o job já existe e está na fila de delay
      const existing = await queue.getJob(jobId);
      if (existing) {
        const state = await existing.getState();
        if (state === "delayed") {
          await existing.changeDelay(COMANDA_NOTIFICATION_DELAY_MS);
          return;
        }
      }
      await queue.add("comanda_notification", data, {
        jobId,
        delay: COMANDA_NOTIFICATION_DELAY_MS,
      });
    },

    async enqueueTextMessage(input) {
      const data = TextMessageJobSchema.parse({ type: "text_message", ...input });
      await queue.add("text_message", data);
    },
  };
}

/**
 * Consumer factory usado exclusivamente por apps/worker.
 * Retry exponencial: 3 tentativas (1 s → 2 s → 4 s).
 */
export function createNotificationQueueWorker(
  redisUrl: string,
  handler: (job: NotificationJob) => Promise<void>
): Worker<NotificationJob> {
  return new Worker<NotificationJob>(
    NOTIFICATION_QUEUE,
    async (job: Job<NotificationJob>) => {
      const data = NotificationJobSchema.parse(job.data);
      await handler(data);
    },
    {
      connection: createRedisConnection(redisUrl),
    }
  );
}
