import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "校招一页简历助手",
  description: "人人都有美观简历。本地优先、HR 陪跑式的一页简历工作台。",
  openGraph: {
    title: "校招一页简历助手",
    description: "先填基本信息，再慢慢完善成可投递的一版。不用注册，打开就能用。",
    type: "website",
    locale: "zh_CN",
    siteName: "校招一页简历助手",
  },
  twitter: {
    card: "summary",
    title: "校招一页简历助手",
    description: "先填基本信息，再慢慢完善成可投递的一版。不用注册，打开就能用。",
  },
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
