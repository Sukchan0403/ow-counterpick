import styles from "./ErrorScreen.module.css";

interface Props {
  onRetry: () => void;
}

export function ErrorScreen({ onRetry }: Props) {
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
      <div className={styles.heading}>일시적인 오류가 발생했어요</div>
      <div className={styles.subtext}>오류 코드 502 · BAD GATEWAY</div>
      <button type="button" className={styles.retryButton} onClick={onRetry}>
        다시 시도
      </button>
    </div>
  );
}
