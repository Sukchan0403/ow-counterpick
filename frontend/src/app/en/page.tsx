import type { Metadata } from "next";
import { HomeClient } from "@/components/HomeClient";

const TITLE = "Overwatch Counterpick Assistant | Counter Pick Finder";
const DESCRIPTION =
  "Enter the enemy team, your own team, and the map, and get an instant counter-pick recommendation for the open role — backed by counter, synergy, and map-fit reasoning.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/en",
    languages: { ko: "/", en: "/en", ja: "/ja" },
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/en",
    locale: "en_US",
    type: "website",
  },
};

export default function Page() {
  return <HomeClient locale="en" />;
}
