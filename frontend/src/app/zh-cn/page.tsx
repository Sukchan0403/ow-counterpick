import type { Metadata } from "next";
import { HomeClient } from "@/components/HomeClient";

const TITLE = "守望先锋克制英雄助手 | 克制推荐";
const DESCRIPTION =
  "输入敌方阵容、我方阵容和地图，即可获得空缺位置的英雄推荐，附带克制、配合与地图适性的具体依据。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/zh-cn",
    languages: { ko: "/", en: "/en", ja: "/ja", "zh-CN": "/zh-cn", "zh-TW": "/zh-tw" },
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/zh-cn",
    locale: "zh_CN",
    type: "website",
  },
};

export default function Page() {
  return <HomeClient locale="zh-cn" />;
}
