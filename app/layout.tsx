import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "校招一页简历助手",
  description: "人人都有美观简历。本地优先、HR 陪跑式的一页简历工作台。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
