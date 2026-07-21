"use server";

import { requireAdmin } from "@/lib/session";
import {
  requestWhatsAppConnect,
  requestWhatsAppDisconnect,
} from "@gestao-de-quadras/core/whatsapp/whatsapp-connection.service";
import { getWhatsAppControlQueue } from "@/lib/queues";

export type WhatsAppActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

export async function connectWhatsAppAction(): Promise<WhatsAppActionState> {
  const { ctx } = await requireAdmin();
  const result = await requestWhatsAppConnect(ctx, getWhatsAppControlQueue());

  if (!result.success) {
    const message =
      result.reason === "already_connected"
        ? "O WhatsApp desta arena já está conectado."
        : "Uma conexão já está em andamento — aguarde o QR Code ou a confirmação.";
    return { status: "error", message };
  }
  return { status: "success" };
}

export async function disconnectWhatsAppAction(): Promise<WhatsAppActionState> {
  const { ctx } = await requireAdmin();
  const result = await requestWhatsAppDisconnect(ctx, getWhatsAppControlQueue());

  if (!result.success) {
    return { status: "error", message: "O WhatsApp desta arena já está desconectado." };
  }
  return { status: "success" };
}
