import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Placas de avaliação",
  description: "Placas físicas com QR Code e NFC pra avaliação no Google.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
