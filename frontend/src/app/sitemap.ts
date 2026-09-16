import type { MetadataRoute } from "next";

// Next.js가 이 파일을 /sitemap.xml로 자동 생성해준다. 지금은 페이지가 사실상
// 루트 하나뿐인 단일 페이지 앱이라 엔트리도 하나뿐.
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = "https://ow-counterpick-frontend-production.up.railway.app";
  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
