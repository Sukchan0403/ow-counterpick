// 배포된 사이트의 절대 주소. robots.txt / sitemap.xml / <head> 메타데이터(canonical,
// Open Graph)가 모두 이 값을 쓴다. 빌드(서버) 시점에만 읽히므로 NEXT_PUBLIC_ 접두사가
// 필요 없다.
//   1. NEXT_PUBLIC_SITE_URL — 커스텀 도메인을 붙였을 때 직접 지정
//   2. VERCEL_PROJECT_PRODUCTION_URL — Vercel이 빌드 때 자동으로 넣어주는 프로덕션
//      도메인(프로토콜 없이 "xxx.vercel.app"). 프로젝트 이름이 바뀌어도 따라간다.
//   3. 둘 다 없으면(로컬 개발/CI) 로컬 개발 서버 주소
const vercelProductionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (vercelProductionHost ? `https://${vercelProductionHost}` : "http://localhost:3000");
