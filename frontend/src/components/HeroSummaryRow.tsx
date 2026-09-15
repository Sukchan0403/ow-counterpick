import type { Hero } from "@/lib/types";
import { HeroAvatar } from "./HeroAvatar";
import styles from "./HeroSummaryRow.module.css";

interface Props {
  title: string;
  heroes: Hero[];
  selectedIds: string[];
  maxCount: number;
  onRemove: (heroId: string) => void;
  onOpenPicker: () => void;
  hasError?: boolean;
}

// 메인 화면에 53명짜리 큰 그리드를 그대로 박아두면 스크롤이 길어져서, 이미
// 고른 영웅만 작은 칩으로 요약해서 보여주고 전체 목록은 HeroPickerModal에서
// 고르게 한다 — MapPickerModal이 맵 선택에서 이미 쓰던 것과 같은 패턴.
export function HeroSummaryRow({
  title,
  heroes,
  selectedIds,
  maxCount,
  onRemove,
  onOpenPicker,
  hasError,
}: Props) {
  const selectedHeroes = selectedIds
    .map((id) => heroes.find((h) => h.id === id))
    .filter((h): h is Hero => h !== undefined);

  return (
    <div className={styles.row} style={hasError ? { borderColor: "var(--red)" } : undefined}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        <span className={styles.count}>
          {selectedIds.length}/{maxCount}
        </span>
      </div>
      <div className={styles.chipRow}>
        {selectedHeroes.map((hero) => (
          <span key={hero.id} className={styles.chip}>
            <HeroAvatar iconUrl={hero.icon_url} name={hero.name} variant="icon" />
            {hero.name}
            <button
              type="button"
              className={styles.chipRemove}
              onClick={() => onRemove(hero.id)}
              aria-label={`${hero.name} 제거`}
            >
              ×
            </button>
          </span>
        ))}
        {selectedIds.length < maxCount && (
          <button type="button" className={styles.addButton} onClick={onOpenPicker}>
            + 추가
          </button>
        )}
      </div>
    </div>
  );
}
