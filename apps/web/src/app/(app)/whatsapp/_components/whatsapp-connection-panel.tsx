"use client";

import { useEffect, useState, useTransition } from "react";
import { QrCode } from "@/components/ui/qr-code";
import type { WhatsAppConnectionSnapshot, WhatsAppConnectionStatus } from "@gestao-de-quadras/messaging";
import { connectWhatsAppAction, disconnectWhatsAppAction } from "../_actions/whatsapp.actions";

const STATUS_LABEL: Record<WhatsAppConnectionStatus, string> = {
  disconnected: "Desconectado",
  connecting: "Conectando…",
  qr_pending: "Aguardando leitura do QR Code",
  connected: "Conectado",
  disconnected_permanent: "Desconectado — leia o QR Code novamente",
};

const STATUS_TONE: Record<WhatsAppConnectionStatus, { fg: string; bg: string }> = {
  disconnected: { fg: "var(--danger)", bg: "var(--danger-bg)" },
  disconnected_permanent: { fg: "var(--danger)", bg: "var(--danger-bg)" },
  connecting: { fg: "var(--warning)", bg: "var(--warning-bg)" },
  qr_pending: { fg: "var(--warning)", bg: "var(--warning-bg)" },
  connected: { fg: "var(--success)", bg: "var(--success-bg)" },
};

export function WhatsAppConnectionPanel({
  initialSnapshot,
}: {
  initialSnapshot: WhatsAppConnectionSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const source = new EventSource("/api/whatsapp/status");
    source.onmessage = (event) => {
      try {
        setSnapshot(JSON.parse(event.data) as WhatsAppConnectionSnapshot);
      } catch {
        // Evento malformado — mantém o último estado válido; o próximo evento corrige.
      }
    };
    return () => source.close();
  }, []);

  function handleConnect() {
    setError(null);
    startTransition(async () => {
      const result = await connectWhatsAppAction();
      if (result.status === "error") setError(result.message);
    });
  }

  function handleDisconnect() {
    setError(null);
    startTransition(async () => {
      const result = await disconnectWhatsAppAction();
      if (result.status === "error") setError(result.message);
    });
  }

  const tone = STATUS_TONE[snapshot.status];
  const canConnect = snapshot.status === "disconnected" || snapshot.status === "disconnected_permanent";
  const canDisconnect =
    snapshot.status === "connected" || snapshot.status === "connecting" || snapshot.status === "qr_pending";

  return (
    <div className="max-w-md bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-6">
      {error && (
        <div
          className="mb-4 px-3 py-2.5 rounded-[var(--radius-control)] text-sm"
          style={{
            backgroundColor: "var(--danger-bg)",
            border: "1px solid var(--danger-border)",
            color: "var(--danger)",
          }}
        >
          {error}
        </div>
      )}

      <span
        className="inline-flex items-center gap-1.5 h-7 px-3 rounded-[var(--radius-pill)] text-[12.5px] font-semibold"
        style={{ backgroundColor: tone.bg, color: tone.fg }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tone.fg }} />
        {STATUS_LABEL[snapshot.status]}
      </span>

      {snapshot.status === "qr_pending" && snapshot.qrCode && (
        <div className="flex flex-col items-center gap-2 my-5">
          <QrCode value={snapshot.qrCode} />
          <p className="text-[12.5px] text-[var(--text-3)] text-center">
            No celular da arena: WhatsApp → Aparelhos conectados → Conectar um aparelho.
          </p>
        </div>
      )}

      {snapshot.status === "connected" && snapshot.phoneNumber && (
        <p className="my-5 text-sm text-[var(--text-2)]">
          Número conectado: <span className="font-medium text-[var(--text-1)]">{snapshot.phoneNumber}</span>
        </p>
      )}

      {snapshot.status === "connecting" && snapshot.reconnectAttempts > 0 && (
        <p className="my-5 text-[12.5px] text-[var(--text-3)]">
          Tentando reconectar automaticamente (tentativa {snapshot.reconnectAttempts})…
        </p>
      )}

      <div className="flex gap-3 mt-2">
        {canConnect && (
          <button
            type="button"
            onClick={handleConnect}
            disabled={pending}
            className="h-9 px-4 text-sm font-semibold text-white rounded-[var(--radius-button)] disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)" }}
          >
            {pending ? "Conectando…" : "Conectar WhatsApp"}
          </button>
        )}
        {canDisconnect && (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={pending}
            className="h-9 px-4 text-sm font-medium rounded-[var(--radius-button)] border border-[var(--border)] disabled:opacity-50"
            style={{ color: "var(--danger)" }}
          >
            Desconectar
          </button>
        )}
      </div>
    </div>
  );
}
