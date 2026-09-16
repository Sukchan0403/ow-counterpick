"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n";
import styles from "./ThemeToggle.module.css";

type Theme = "dark" | "light";

function applyTheme(theme: Theme) {
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // 프라이빗 모드 등에서 localStorage가 막혀있어도 토글 자체는 계속 동작해야 함
  }
}

export function ThemeToggle({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  // layout.tsx의 인라인 스크립트가 하이드레이션 전에 이미 [data-theme]를 붙여뒀으니,
  // 마운트 시 그 값을 그대로 읽어와 React 상태와 실제 DOM을 일치시킨다.
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    // 서버 렌더링 시점엔 document가 없어 항상 "dark"로 렌더되므로, 하이드레이션
    // 미스매치를 피하려면 실제 DOM 값(layout.tsx의 인라인 스크립트가 이미
    // 반영해둔 값) 동기화는 마운트 이후로 미뤄야 한다 — 여기서 한 번만 실행됨.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button
      type="button"
      className={styles.button}
      onClick={toggle}
      aria-label={theme === "dark" ? t.switchToLight : t.switchToDark}
      title={theme === "dark" ? t.switchToLight : t.switchToDark}
    >
      {theme === "dark" ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 1020.354 15.354z" />
        </svg>
      )}
    </button>
  );
}
