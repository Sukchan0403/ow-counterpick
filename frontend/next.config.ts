import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 이미지에 node_modules 전체 대신 필요한 파일만 담긴 .next/standalone
  // 산출물을 만들기 위함 (frontend/Dockerfile 참고).
  output: "standalone",
};

export default nextConfig;
