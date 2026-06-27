import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "단어 챌린지 🏆",
  description: "영어 단어 학습 챌린지",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
