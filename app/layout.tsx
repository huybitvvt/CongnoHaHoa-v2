import type { Metadata } from "next";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "SpeedGo Logistics | OMS vận hành",
  description: "Hệ thống quản trị đơn hàng, kho, fulfillment và tài chính SpeedGo Logistics",
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
