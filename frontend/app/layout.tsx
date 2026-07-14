import type { Metadata } from "next";
import "./globals.css";
import SessionRoot from "@/components/SessionRoot";

export const metadata: Metadata = {
  title: "日本語音声認識 — Japanese STT",
  description: "リアルタイム日本语音转录 — Faster-Whisper Medium",
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-[#0a0a0f] text-[#e4e4e7] antialiased">
        <SessionRoot apiBase={API_BASE}>{children}</SessionRoot>
      </body>
    </html>
  );
}