import { sql } from "drizzle-orm";
import { db } from "@gestao-de-quadras/db";
import { rows } from "../../../packages/core/src/db/tenant";
import { ResendEmailProvider } from "../../../packages/core/src/email/email.provider";
import { BaileysMessagingProvider } from "../../../packages/messaging/src/baileys/baileys-messaging-provider";
import { createControlQueueWorker } from "../../../packages/messaging/src/control-queue";
import { createStatusEventPublisher } from "../../../packages/messaging/src/events";
import { sendWhatsAppDisconnectedAlert } from "./whatsapp-alerts";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL não configurada. Defina a variável de ambiente antes de iniciar o worker.");
}

async function activeTenantIds(): Promise<string[]> {
  const result = await db.execute<{ id: string }>(sql`SELECT id FROM tenants WHERE status = 'active'`);
  return rows<{ id: string }>(result).map((r) => r.id);
}

async function main(): Promise<void> {
  const emailProvider = new ResendEmailProvider(process.env.RESEND_API_KEY ?? "");
  const provider = new BaileysMessagingProvider(db);
  const statusPublisher = createStatusEventPublisher(redisUrl as string);

  provider.onEvent((event) => {
    if (event.type === "statusChange") {
      void statusPublisher.publish(event.tenantId, event.snapshot);
      return;
    }
    // permanentDisconnect (AC4) — alerta os Admins ativos com e-mail cadastrado.
    void sendWhatsAppDisconnectedAlert(event.tenantId, { db, emailProvider }).catch((err) => {
      console.error(`[whatsapp-alerts] falha ao alertar tenant ${event.tenantId}:`, err);
    });
  });

  const controlWorker = createControlQueueWorker(redisUrl as string, provider);

  const tenantIds = await activeTenantIds();
  await provider.bootstrap(tenantIds);
  console.log(`[worker] pool WhatsApp iniciado — ${tenantIds.length} arena(s) ativa(s).`);

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[worker] recebido ${signal}, encerrando...`);
    await controlWorker.close();
    await statusPublisher.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[worker] falha fatal na inicialização:", err);
  process.exit(1);
});
