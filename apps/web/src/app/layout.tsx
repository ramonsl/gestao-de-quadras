import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-instrument-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Arena SaaS — Gestão de Arenas Esportivas",
  description:
    "Plataforma de gestão para arenas de padel e beach tennis: PDV, comandas, reservas, fidelidade e muito mais.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${instrumentSans.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
