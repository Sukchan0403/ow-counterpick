import type { Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n";
import styles from "./ErrorScreen.module.css";

interface Props {
  onRetry: () => void;
  locale: Locale;
}

export function ErrorScreen({ onRetry, locale }: Props) {
  const t = getDictionary(locale);
  return (
    <div className={styles.wrap}>
      <div className={styles.iconCircle} aria-hidden>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3l10 18H2L12 3z"
            stroke="var(--red)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M12 10v4" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="12" cy="17" r="1" fill="var(--red)" />
        </svg>
      </div>
      <div className={styles.heading}>{t.errorHeading}</div>
      <div className={styles.subtext}>{t.errorSubtext}</div>
      <button type="button" className={styles.retryButton} onClick={onRetry}>
        {t.retry}
      </button>
    </div>
  );
}
