import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "오버워치 밴프준 보조",
  description: "상대 조합, 우리 조합, 맵을 고려한 빈 포지션 영웅 추천 (개인 포트폴리오 프로젝트)",
};

// 저장된 테마를 React 하이드레이션 전에 <html>에 붙여서, 라이트 모드로 저장해둔
// 사용자가 새로고침할 때 다크(기본값)가 잠깐 보였다가 바뀌는 깜빡임을 막는다.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var saved = localStorage.getItem("theme");
    if (saved === "light") document.documentElement.setAttribute("data-theme", "light");
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
