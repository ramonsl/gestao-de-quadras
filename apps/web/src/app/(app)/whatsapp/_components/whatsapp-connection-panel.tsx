"use client";

import { useEffect, useState, useTransition } from "react";
import { QrCode } from "@/components/ui/qr-code";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { WhatsAppConnectionSnapshot, WhatsAppConnectionStatus } from "@gestao-de-quadras/messaging";
import { connectWhatsAppAction, disconnectWhatsAppAction } from "../_actions/whatsapp.actions";

const STATUS_LABEL: Record<WhatsAppConnectionStatus, string> = {
  disconnected: "Desconectado",
  connecting: "Conectando…",
  qr_pending: "Aguardando leitura do QR Code",
  connected: "Conectado",
  disconnected_permanent: "Desconectado — leia o QR Code novamente",
};

/** Design system: "Status: ponto 9px colorido + rótulo 13.5/600". */
const STATUS_COLOR: Record<WhatsAppConnectionStatus, string> = {
  disconnected: "var(--danger)",
  disconnected_permanent: "var(--danger)",
  connecting: "var(--warning)",
  qr_pending: "var(--warning)",
  connected: "var(--success)",
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

  const statusColor = STATUS_COLOR[snapshot.status];
  const canConnect = snapshot.status === "disconnected" || snapshot.status === "disconnected_permanent";
  const canDisconnect =
    snapshot.status === "connected" || snapshot.status === "connecting" || snapshot.status === "qr_pending";

  return (
    <div className="max-w-md bg-white border border-[var(--border)] rounded-[var(--radius-card)] p-6">
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <span className="inline-flex items-center gap-2">
        <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ backgroundColor: statusColor }} />
        <span className="text-[13.5px] font-semibold" style={{ color: statusColor }}>
          {STATUS_LABEL[snapshot.status]}
        </span>
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
