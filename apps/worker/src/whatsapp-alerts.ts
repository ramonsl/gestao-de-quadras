import { sql } from "drizzle-orm";
import { listArenaUsers, type ArenaUserContext } from "../../../packages/core/src/users/user.service";
import type { EmailProvider } from "../../../packages/core/src/email/email.provider";
import {
  getOrCreateConnection,
  updateConnection,
} from "../../../packages/messaging/src/state/connection-repository";
import { rows, type ArenaDb } from "../../../packages/core/src/db/tenant";

export interface WhatsAppAlertDeps {
  db: ArenaDb;
  emailProvider: EmailProvider;
}

async function fetchTenantName(db: ArenaDb, tenantId: string): Promise<string> {
  const result = await db.execute<{ name: string }>(
    sql`SELECT name FROM tenants WHERE id = ${tenantId} LIMIT 1`
  );
  return rows<{ name: string }>(result)[0]?.name ?? "sua arena";
}

/**
 * AC4 — WhatsApp desconectado permanentemente (logout no celular): alerta por
 * e-mail a todos os Admins ativos com e-mail cadastrado. Dedupe via
 * `permanent_alert_sent_at` — nunca reenviar em loop de reconexão; o campo é
 * resetado pelo pool ao reconectar com sucesso, então uma NOVA desconexão
 * permanente futura volta a alertar.
 */
export async function sendWhatsAppDisconnectedAlert(
  tenantId: string,
  deps: WhatsAppAlertDeps
): Promise<void> {
  const ref = { db: deps.db, tenantId };
  const connection = await getOrCreateConnection(ref);
  if (connection.permanentAlertSentAt) return;

  const ctx: ArenaUserContext = { db: deps.db, tenantId, actorUserId: "system" };
  const admins = await listArenaUsers(ctx);
  const recipients = admins.filter(
    (u): u is typeof u & { email: string } => u.role === "admin" && u.status === "active" && !!u.email
  );

  if (recipients.length === 0) {
    console.warn(
      `[whatsapp-alerts] tenant ${tenantId}: nenhum admin ativo com e-mail cadastrado — alerta não enviado.`
    );
    return;
  }

  const arenaName = await fetchTenantName(deps.db, tenantId);
  const disconnectedAt = new Date();

  for (const admin of recipients) {
    await deps.emailProvider.sendWhatsAppDisconnectedAlert({
      to: admin.email,
      arenaName,
      disconnectedAt,
    });
  }

  await updateConnection(ref, { permanentAlertSentAt: disconnectedAt });
}
