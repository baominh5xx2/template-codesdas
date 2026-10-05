import type { Metadata } from "next";
import "@copilotkit/react-core/v2/styles.css";
import "./globals.css";
import "@/ui/chat/chat-theme.css";

export const metadata: Metadata = {
  title: "Hackathon Starter Kit",
  description: "An isolated, modular foundation for a hackathon app.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
