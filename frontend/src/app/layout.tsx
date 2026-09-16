import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://ow-counterpick-frontend-production.up.railway.app";
const SITE_TITLE = "오버워치 밴프준 보조 | 카운터픽 추천";
const SITE_DESCRIPTION =
  "상대 조합, 우리 조합, 맵을 입력하면 빈 포지션에 어떤 영웅을 픽해야 할지 카운터·시너지·맵 궁합 근거와 함께 바로 추천해주는 오버워치 밴픽 보조 도구.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: [
    "오버워치",
    "오버워치 카운터픽",
    "오버워치 밴픽",
    "오버워치 픽 추천",
    "오버워치 카운터",
    "overwatch counter pick",
  ],
  robots: { index: true, follow: true },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: "오버워치 밴프준 보조",
    locale: "ko_KR",
    type: "website",
  },
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
