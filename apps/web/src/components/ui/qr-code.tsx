"use client";

import ReactQrCode from "react-qr-code";

interface QrCodeProps {
  value: string;
  size?: number;
}

/** Wrapper fino sobre `react-qr-code` — não existe componente de QR no shadcn/ui (WPP-01). */
export function QrCode({ value, size = 200 }: QrCodeProps) {
  return (
    <div className="p-3 bg-white rounded-[var(--radius-card)] border border-[var(--border)] inline-block">
      <ReactQrCode value={value} size={size} />
    </div>
  );
}
