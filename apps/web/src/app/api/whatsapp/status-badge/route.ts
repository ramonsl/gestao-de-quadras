import { getArenaSession } from "@/lib/session";
import { getArenaUser } from "@gestao-de-quadras/core/users/user.service";
import { db } from "@gestao-de-quadras/db";
import { subscribeToStatus, toPublicStatus } from "@gestao-de-quadras/messaging";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * SSE de status do WhatsApp para o indicador global — visível a QUALQUER
 * operador ativo da arena (não só Admin), diferente de `api/whatsapp/status`
 * (admin-only, carrega o QR Code). Aqui o snapshot passa por
 * `toPublicStatus()` antes de sair: nunca vaza `qrCode` (segredo de
 * pareamento) nem `phoneNumber` para quem não é Admin.
 *
 * Mesmo cuidado de isolamento de `api/whatsapp/status`: tenant sempre da
 * sessão do servidor, role revalidado no banco.
 */
export async function GET() {
  const session = await getArenaSession();
  if (!session) {
    return new Response("Não autenticado.", { status: 401 });
  }

  const currentUser = await getArenaUser(
    { db, tenantId: session.tenantId, actorUserId: session.userId },
    session.userId
  );
  if (!currentUser || currentUser.status !== "active") {
    return new Response("Não autenticado.", { status: 401 });
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error("[whatsapp/status-badge] REDIS_URL não configurada.");
    return new Response("Erro interno. Tente novamente.", { status: 500 });
  }

  const encoder = new TextEncoder();
  let subscription: ReturnType<typeof subscribeToStatus> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      subscription = subscribeToStatus(redisUrl, session.tenantId, (snapshot) => {
        const publicStatus = toPublicStatus(snapshot);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(publicStatus)}\n\n`));
      });
    },
    cancel() {
      void subscription?.unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
