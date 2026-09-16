import type { Metadata } from "next";
import { HomeClient } from "@/components/HomeClient";

const TITLE = "オーバーウォッチ カウンターピック補助 | おすすめピック";
const DESCRIPTION =
  "敵チーム・味方チーム・マップを入力するだけで、空いているポジションに合うヒーローをカウンター・シナジー・マップ相性の根拠付きで即座におすすめする、オーバーウォッチのピック補助ツール。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/ja",
    languages: { ko: "/", en: "/en", ja: "/ja" },
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/ja",
    locale: "ja_JP",
    type: "website",
  },
};

export default function Page() {
  return <HomeClient locale="ja" />;
}
