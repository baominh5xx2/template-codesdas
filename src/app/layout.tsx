import type { Metadata } from "next";
import localFont from "next/font/local";
import { loadSite } from "@/site/load";
import "@/ui/styles/tokens.css";
import "@/ui/styles/ui.css";
import "@copilotkit/react-core/v2/styles.css";
import "./globals.css";
import "@/ui/chat/chat-theme.css";

// Manrope (SIL OFL 1.1, Vietnamese coverage), bundled locally so the app boots offline.
const manrope = localFont({
  src: [{ path: "./fonts/Manrope.ttf", weight: "200 800", style: "normal" }],
  variable: "--font-manrope",
  display: "swap",
});

const site = loadSite();

export const metadata: Metadata = {
  title: { default: site.metadata.title, template: `%s · ${site.brand.team}` },
  description: site.metadata.description,
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
