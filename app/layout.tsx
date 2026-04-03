import type { Metadata } from "next";
import { Noto_Serif_SC, Noto_Sans_SC } from "next/font/google";

import "./globals.css";

const serifFont = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

const sansFont = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ResumeForge — 你的经历值得更好的表达",
  description: "面向校招的 AI 简历工作台。丢进来任何材料，60 秒出第一版，然后一起打磨到可投递。",
  openGraph: {
    title: "ResumeForge — 你的经历值得更好的表达",
    description: "面向校招的 AI 简历工作台。丢进来任何材料，60 秒出第一版。",
    type: "website",
    locale: "zh_CN",
    siteName: "ResumeForge",
  },
  twitter: {
    card: "summary",
    title: "ResumeForge — 你的经历值得更好的表达",
    description: "面向校招的 AI 简历工作台。丢进来任何材料，60 秒出第一版。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${serifFont.variable} ${sansFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
