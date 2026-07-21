import { getArenaSession } from "@/lib/session";
import { getArenaUser } from "@gestao-de-quadras/core/users/user.service";
import { db } from "@gestao-de-quadras/db";
import { subscribeToStatus } from "@gestao-de-quadras/messaging";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * SSE de status da conexão WhatsApp (AC3). O tenant vem SEMPRE da sessão do
 * servidor — nunca de um parâmetro do cliente — para não permitir que um
 * operador leia o status de outra arena trocando um ID na URL (IDOR).
 *
 * Usa `getArenaSession()` (não `requireSession()`): dentro de um Route Handler
 * o `redirect()` de `next/navigation` não produz uma resposta HTTP válida —
 * erro de autenticação aqui deve ser um 401 explícito.
 *
 * O `role` é revalidado no banco (não confia só no claim do JWT, que fica
 * estático até expirar): o QR Code transmitido aqui é um segredo de
 * pareamento — um Admin rebaixado ou desativado não pode continuar recebendo
 * eventos deste endpoint até a sessão expirar (mesmo cuidado de `requireSession`
 * em `@/lib/session`).
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
  if (currentUser.role !== "admin") {
    return new Response("Acesso restrito ao Admin.", { status: 403 });
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error("[whatsapp/status] REDIS_URL não configurada.");
    return new Response("Erro interno. Tente novamente.", { status: 500 });
  }

  const encoder = new TextEncoder();
  let subscription: ReturnType<typeof subscribeToStatus> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      subscription = subscribeToStatus(redisUrl, session.tenantId, (snapshot) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`));
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
