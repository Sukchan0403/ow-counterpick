import type { Metadata } from "next";
import { HomeClient } from "@/components/HomeClient";

const TITLE = "鬥陣特攻剋制英雄助手 | 剋制推薦";
const DESCRIPTION =
  "輸入敵方陣容、我方陣容和地圖，即可獲得空缺位置的英雄推薦，附帶剋制、搭配與地圖適性的具體依據。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/zh-tw",
    languages: { ko: "/", en: "/en", ja: "/ja", "zh-CN": "/zh-cn", "zh-TW": "/zh-tw" },
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/zh-tw",
    locale: "zh_TW",
    type: "website",
  },
};

export default function Page() {
  return <HomeClient locale="zh-tw" />;
}
