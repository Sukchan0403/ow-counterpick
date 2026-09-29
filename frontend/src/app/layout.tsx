import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

// 빌드 타임에 주입되는 값(NEXT_PUBLIC_API_BASE_URL과 같은 방식 — 런타임
// 환경변수가 아니라 빌드 인자). 로컬 개발/CI/아직 값을 안 넣은 배포에서는
// undefined라 아래에서 스크립트 자체를 렌더링하지 않는다 — 잘못된 ID로 빈
// 이벤트를 구글에 보내는 것보다, 조용히 꺼두는 쪽이 안전함.
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

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
  alternates: {
    canonical: "/",
    languages: { ko: "/", en: "/en", ja: "/ja", "zh-CN": "/zh-cn", "zh-TW": "/zh-tw" },
  },
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

// 검색 엔진이 사이트 성격(이름/설명/무료 웹앱)을 명확히 이해하도록 돕는
// JSON-LD. 순위를 직접 올려주진 않지만, 리치 결과(사이트링크 검색창 등)
// 후보가 되는 데 도움이 되고 사실상 비용이 없어 넣는다.
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_TITLE,
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  applicationCategory: "GameApplication",
  operatingSystem: "Any (Web)",
  inLanguage: ["ko", "en", "ja", "zh-CN", "zh-TW"],
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
        {GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
