import type { Metadata } from "next";
import localFont from "next/font/local";
import "@copilotkit/react-core/v2/styles.css";
import "./globals.css";
import "@/ui/chat/chat-theme.css";

// Manrope (SIL OFL 1.1, Vietnamese coverage), bundled locally so the app boots offline.
const manrope = localFont({
  src: [{ path: "./fonts/Manrope.ttf", weight: "200 800", style: "normal" }],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TriplePeek Studio · AI Thực chiến",
  description: "Trợ lý coding của nhóm TriplePeek tại AI Thực chiến.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
