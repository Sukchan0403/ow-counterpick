import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { LOCALE_LABEL, LOCALES } from "@/lib/i18n";
import styles from "./LanguageSwitcher.module.css";

// 로케일별 페이지(app/page.tsx=ko, app/en/page.tsx, app/ja/page.tsx)로 가는
// 평범한 <Link>들. 클라이언트 JS 없이도 크롤러가 세 언어 페이지를 서로
// 발견할 수 있어야 해서(SEO), 드롭다운/토글이 아니라 실제 링크로 구현한다.
const LOCALE_PATH: Record<Locale, string> = { ko: "/", en: "/en", ja: "/ja" };

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  return (
    <div className={styles.switcher}>
      {LOCALES.map((l) => (
        <Link
          key={l}
          href={LOCALE_PATH[l]}
          className={`${styles.link} ${l === locale ? styles.active : ""}`}
          aria-current={l === locale ? "true" : undefined}
        >
          {LOCALE_LABEL[l]}
        </Link>
      ))}
    </div>
  );
}
