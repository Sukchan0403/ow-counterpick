import type { MetadataRoute } from "next";

// Next.js가 이 파일을 /sitemap.xml로 자동 생성해준다. 언어별 페이지(/, /en, /ja,
// /zh-cn, /zh-tw)가 서로의 번역본이라는 걸 alternates.languages(hreflang)로
// 명시해서, 구글이 검색 사용자의 언어에 맞는 버전을 골라 보여주게 한다.
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = "https://ow-counterpick-frontend-production.up.railway.app";
  const languages = {
    ko: siteUrl,
    en: `${siteUrl}/en`,
    ja: `${siteUrl}/ja`,
    "zh-CN": `${siteUrl}/zh-cn`,
    "zh-TW": `${siteUrl}/zh-tw`,
  };
  const lastModified = new Date();
  const paths = ["", "/en", "/ja", "/zh-cn", "/zh-tw"];
  return paths.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 1,
    alternates: { languages },
  }));
}
