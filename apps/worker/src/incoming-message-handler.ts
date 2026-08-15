import { sql } from "drizzle-orm";
import IORedis from "ioredis";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type * as schema from "@gestao-de-quadras/db/schema";
import type { NotificationQueuePort } from "../../../packages/messaging/src/notification-queue";
import {
  processOptInOutKeyword,
  isMenuKeyword,
  processMenuRequest,
} from "../../../packages/core/src/whatsapp/notification.service";
import { rows } from "../../../packages/core/src/db/tenant";

type ArenaDb = NeonHttpDatabase<typeof schema>;

type CustomerRow = {
  id: string;
  name: string;
  whatsapp: string | null;
};

const MENU_RATE_LIMIT_TTL_SECONDS = 30;

function menuRateLimitKey(tenantId: string, fromE164: string): string {
  return `wpp:menu-ratelimit:${tenantId}:${fromE164}`;
}

export function createIncomingMessageHandler(
  db: ArenaDb,
  queue: NotificationQueuePort,
  redis: IORedis
) {
  return async function handleIncomingMessage(input: {
    tenantId: string;
    fromE164: string;
    text: string;
  }): Promise<void> {
    const { tenantId, fromE164, text } = input;

    const ctx = { db, tenantId };

    // WPP-03 — Opt-out / Opt-in
    const optResult = await processOptInOutKeyword(ctx, { fromE164, text }, queue);
    if (optResult !== "ignored") return;

    // WPP-05 — Menu de autoatendimento
    if (!isMenuKeyword(text)) return;

    // Rate-limit: evita flood de mensagens de menu (30s entre respostas)
    const rateLimitKey = menuRateLimitKey(tenantId, fromE164);
    const alreadyLimited = await redis.get(rateLimitKey);
    if (alreadyLimited) return;
    await redis.set(rateLimitKey, "1", "EX", MENU_RATE_LIMIT_TTL_SECONDS);

    const customerResult = await db.execute<CustomerRow>(
      sql`SELECT id, name, whatsapp
          FROM customers
          WHERE whatsapp = ${fromE164}
            AND tenant_id = ${tenantId}
          LIMIT 1`
    );
    const customer = rows<CustomerRow>(customerResult)[0];

    let menuText: string;
    if (!customer) {
      menuText = "Olá! Para usar o autoatendimento, cadastre-se na arena.";
    } else {
      menuText = await processMenuRequest(ctx, {
        fromE164,
        customerId: customer.id,
        customerName: customer.name,
      });
    }

    await queue.enqueueTextMessage({
      tenantId,
      customerId: customer?.id,
      toE164: fromE164,
      bodyText: menuText,
    });
  };
}
