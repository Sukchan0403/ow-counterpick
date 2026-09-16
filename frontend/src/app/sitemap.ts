import type { MetadataRoute } from "next";

// Next.js가 이 파일을 /sitemap.xml로 자동 생성해준다. 언어별 페이지(/, /en, /ja)가
// 서로의 번역본이라는 걸 alternates.languages(hreflang)로 명시해서, 구글이 검색
// 사용자의 언어에 맞는 버전을 골라 보여주게 한다.
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = "https://ow-counterpick-frontend-production.up.railway.app";
  const languages = {
    ko: siteUrl,
    en: `${siteUrl}/en`,
    ja: `${siteUrl}/ja`,
  };
  const lastModified = new Date();
  return [
    { url: siteUrl, lastModified, changeFrequency: "weekly", priority: 1, alternates: { languages } },
    { url: `${siteUrl}/en`, lastModified, changeFrequency: "weekly", priority: 1, alternates: { languages } },
    { url: `${siteUrl}/ja`, lastModified, changeFrequency: "weekly", priority: 1, alternates: { languages } },
  ];
}
