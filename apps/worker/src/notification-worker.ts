import { sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type * as schema from "@gestao-de-quadras/db/schema";
import {
  createNotificationQueueWorker,
  type NotificationJob,
} from "../../../packages/messaging/src/notification-queue";
import type { MessagingProvider } from "../../../packages/messaging/src/provider";
import {
  buildComandaNotificationText,
} from "../../../packages/core/src/whatsapp/notification.service";
import { rows } from "../../../packages/core/src/db/tenant";

type ArenaDb = NeonHttpDatabase<typeof schema>;

type ComandaItemRow = {
  name: string;
  quantity: number;
  unitPriceCents: number;
};

type CustomerRow = {
  id: string;
  whatsapp: string | null;
};

async function handleComandaNotification(
  db: ArenaDb,
  provider: MessagingProvider,
  job: Extract<NotificationJob, { type: "comanda_notification" }>
): Promise<void> {
  const { tenantId, comandaId, customerId, toE164 } = job;

  const itemsResult = await db.execute<ComandaItemRow>(
    sql`SELECT product_name_at_sale AS name,
               quantity,
               unit_price_cents_at_sale AS "unitPriceCents"
        FROM comanda_items
        WHERE tenant_id = ${tenantId}
          AND comanda_id = ${comandaId}
        ORDER BY created_at`
  );
  const items = rows<ComandaItemRow>(itemsResult);
  if (items.length === 0) return;

  const totalCents = items.reduce((sum, it) => sum + it.quantity * it.unitPriceCents, 0);
  const bodyText = buildComandaNotificationText(items, totalCents);

  const now = new Date();
  await db.execute(
    sql`INSERT INTO whatsapp_message_log
          (tenant_id, customer_id, comanda_id, to_e164, body_text, status, created_at)
        VALUES (${tenantId}, ${customerId}, ${comandaId}, ${toE164}, ${bodyText}, 'queued', ${now})`
  );

  const sendResult = await provider.sendMessage({ tenantId, toE164, text: bodyText });

  if (sendResult.success) {
    await db.execute(
      sql`UPDATE whatsapp_message_log
          SET status = 'sent',
              provider_message_id = ${sendResult.providerMessageId ?? null},
              sent_at = ${now}
          WHERE id = (
            SELECT id FROM whatsapp_message_log
            WHERE tenant_id = ${tenantId}
              AND customer_id = ${customerId}
              AND comanda_id = ${comandaId}
              AND status = 'queued'
            ORDER BY created_at DESC LIMIT 1
          )`
    );
  } else {
    await db.execute(
      sql`UPDATE whatsapp_message_log
          SET status = 'error',
              error_description = ${sendResult.reason ?? null}
          WHERE id = (
            SELECT id FROM whatsapp_message_log
            WHERE tenant_id = ${tenantId}
              AND customer_id = ${customerId}
              AND comanda_id = ${comandaId}
              AND status = 'queued'
            ORDER BY created_at DESC LIMIT 1
          )`
    );
    throw new Error(`sendMessage falhou: ${sendResult.reason}`);
  }
}

async function handleTextMessage(
  db: ArenaDb,
  provider: MessagingProvider,
  job: Extract<NotificationJob, { type: "text_message" }>
): Promise<void> {
  const { tenantId, toE164, bodyText, comandaId } = job;
  const customerId = job.customerId ?? null;

  const now = new Date();
  if (customerId) {
    await db.execute(
      sql`INSERT INTO whatsapp_message_log
            (tenant_id, customer_id, comanda_id, to_e164, body_text, status, created_at)
          VALUES (${tenantId}, ${customerId}, ${comandaId ?? null}, ${toE164}, ${bodyText}, 'queued', ${now})`
    );
  }

  const sendResult = await provider.sendMessage({ tenantId, toE164, text: bodyText });

  if (customerId) {
    if (sendResult.success) {
      await db.execute(
        sql`UPDATE whatsapp_message_log
            SET status = 'sent',
                provider_message_id = ${sendResult.providerMessageId ?? null},
                sent_at = ${now}
            WHERE id = (
              SELECT id FROM whatsapp_message_log
              WHERE tenant_id = ${tenantId}
                AND customer_id = ${customerId}
                AND status = 'queued'
              ORDER BY created_at DESC LIMIT 1
            )`
      );
    } else {
      await db.execute(
        sql`UPDATE whatsapp_message_log
            SET status = 'error',
                error_description = ${sendResult.reason ?? null}
            WHERE id = (
              SELECT id FROM whatsapp_message_log
              WHERE tenant_id = ${tenantId}
                AND customer_id = ${customerId}
                AND status = 'queued'
              ORDER BY created_at DESC LIMIT 1
            )`
      );
    }
  }

  if (!sendResult.success) {
    throw new Error(`sendMessage falhou: ${sendResult.reason}`);
  }
}

export function startNotificationWorker(
  redisUrl: string,
  db: ArenaDb,
  provider: MessagingProvider
): ReturnType<typeof createNotificationQueueWorker> {
  return createNotificationQueueWorker(redisUrl, async (job: NotificationJob) => {
    if (job.type === "comanda_notification") {
      await handleComandaNotification(db, provider, job);
    } else {
      await handleTextMessage(db, provider, job);
    }
  });
}
