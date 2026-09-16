import type { MetadataRoute } from "next";

// Next.js가 이 파일을 /robots.txt로 자동 생성해준다. 검색엔진 크롤러에게
// "전체 공개, 크롤링 다 해도 된다"고 명시적으로 알려주는 역할.
export default function robots(): MetadataRoute.Robots {
  const siteUrl = "https://ow-counterpick-frontend-production.up.railway.app";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
