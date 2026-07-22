"use client";

import { useEffect, useState } from "react";

function parseTimestamp(fromVal: string | Date | number | undefined | null): number {
  if (!fromVal) return Date.now();
  if (fromVal instanceof Date) return fromVal.getTime();
  const t = typeof fromVal === "number" ? fromVal : new Date(fromVal).getTime();
  return isNaN(t) ? Date.now() : t;
}

function formatElapsed(fromVal: string | Date | number | undefined | null, now: number): string {
  const timestamp = parseTimestamp(fromVal);
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return "Agora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const restMin = minutes % 60;
  if (hours < 24) {
    return restMin > 0 ? `há ${hours}h ${restMin}min` : `há ${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return days === 1 ? "há 1 dia" : `há ${days} dias`;
}

/** Tempo transcorrido desde a abertura (PDV-04), atualiza sozinho e imune a erros de data. */
export function ElapsedTime({ fromISO }: { fromISO: string | Date | number | undefined | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  return <span suppressHydrationWarning>{formatElapsed(fromISO, now)}</span>;
}
