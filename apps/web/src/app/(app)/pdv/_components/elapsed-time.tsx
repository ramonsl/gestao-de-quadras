"use client";

import { useEffect, useState } from "react";

function formatElapsed(fromISO: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - new Date(fromISO).getTime()) / 1000));
  if (seconds < 60) return "agora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const restMin = minutes % 60;
  return restMin > 0 ? `há ${hours}h ${restMin}min` : `há ${hours}h`;
}

/** Tempo transcorrido desde a abertura da comanda (PDV-04), atualiza sozinho. */
export function ElapsedTime({ fromISO }: { fromISO: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  return <span suppressHydrationWarning>{formatElapsed(fromISO, now)}</span>;
}
