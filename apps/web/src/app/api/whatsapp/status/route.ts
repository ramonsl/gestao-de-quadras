import { getArenaSession } from "@/lib/session";
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
 */
export async function GET() {
  const session = await getArenaSession();
  if (!session) {
    return new Response("Não autenticado.", { status: 401 });
  }
  // O QR Code é um segredo de pareamento — mesma restrição da página (só Admin).
  if (session.role !== "admin") {
    return new Response("Acesso restrito ao Admin.", { status: 403 });
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return new Response("REDIS_URL não configurada.", { status: 500 });
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
