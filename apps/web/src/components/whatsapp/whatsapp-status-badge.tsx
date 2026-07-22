"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { WhatsAppConnectionStatus, WhatsAppPublicStatus } from "@gestao-de-quadras/messaging";

/** Design system: "Status: ponto 9px colorido + rótulo 13.5/600". */
const STATUS_LABEL: Record<WhatsAppConnectionStatus, string> = {
  disconnected: "WhatsApp desconectado",
  connecting: "WhatsApp conectando…",
  qr_pending: "WhatsApp conectando…",
  connected: "WhatsApp conectado",
  disconnected_permanent: "WhatsApp desconectado",
};

const STATUS_COLOR: Record<WhatsAppConnectionStatus, string> = {
  disconnected: "var(--danger)",
  disconnected_permanent: "var(--danger)",
  connecting: "var(--warning)",
  qr_pending: "var(--warning)",
  connected: "var(--success)",
};

/**
 * Indicador global de status do WhatsApp — visível a QUALQUER operador
 * autenticado (não só Admin), diferente do painel completo em `/whatsapp`.
 * Consome `/api/whatsapp/status-badge`, que nunca inclui QR Code nem número
 * de telefone (ver `packages/messaging/src/types.ts#toPublicStatus`).
 */
export function WhatsAppStatusBadge({
  initialStatus,
  isAdmin,
}: {
  initialStatus: WhatsAppConnectionStatus;
  isAdmin: boolean;
}) {
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    const source = new EventSource("/api/whatsapp/status-badge");
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WhatsAppPublicStatus;
        setStatus(data.status);
      } catch {
        // Evento malformado — mantém o último estado válido; o próximo evento corrige.
      }
    };
    return () => source.close();
  }, []);

  const content = (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span
        className="w-[9px] h-[9px] rounded-full shrink-0"
        style={{ backgroundColor: STATUS_COLOR[status] }}
      />
      <span className="text-[13.5px] font-semibold text-white/80 truncate">{STATUS_LABEL[status]}</span>
    </span>
  );

  if (!isAdmin) return content;

  return (
    <Link href="/whatsapp" className="block hover:opacity-80 transition-opacity">
      {content}
    </Link>
  );
}
