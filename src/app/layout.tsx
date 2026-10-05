import type { Metadata } from "next";
import localFont from "next/font/local";
import "@/ui/styles/tokens.css";
import "@/ui/styles/ui.css";
import "./globals.css";

// Manrope — the typeface used on vietcombank.com.vn (SIL OFL 1.1, includes Vietnamese).
const manrope = localFont({
  src: [{ path: "./fonts/Manrope.ttf", weight: "200 800", style: "normal" }],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Thực chiến AI", template: "%s · Thực chiến AI" },
  description: "Bộ khung hackathon: sáu mẫu bài toán trên nền tảng dùng chung.",
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
