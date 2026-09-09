import type { Metadata } from "next";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "Quản lý công nợ | SpeeGo Logistics",
  description: "Hệ thống quản lý công nợ và vận hành phân phối SpeeGo Logistics",
  icons: {
    icon: "/speego-logistics.jpg",
    shortcut: "/speego-logistics.jpg",
    apple: "/speego-logistics.jpg",
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
