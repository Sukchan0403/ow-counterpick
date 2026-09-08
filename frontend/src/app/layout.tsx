import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "오버워치 밴프준 보조",
  description: "상대 조합, 우리 조합, 맵을 고려한 빈 포지션 영웅 추천 (개인 포트폴리오 프로젝트)",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
