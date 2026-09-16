import type { HeroRecommendation, Role } from "@/lib/types";
import type { Locale } from "@/lib/i18n";
import { ROLE_LABEL, getDictionary } from "@/lib/i18n";
import { HeroAvatar } from "./HeroAvatar";
import styles from "./ResultsPanel.module.css";

interface Props {
  recommendations: HeroRecommendation[];
  emptyPosition: Role;
  notice: string | null;
  locale: Locale;
}

export function ResultsPanel({ recommendations, emptyPosition, notice, locale }: Props) {
  const t = getDictionary(locale);
  return (
    <div>
      <div className={styles.inferredPosition}>
        {t.inferredPositionPrefix}
        <strong>{ROLE_LABEL[locale][emptyPosition]}</strong>
      </div>

      {notice && <div className={styles.notice}>{notice}</div>}

      <div className={styles.legend}>
        <span>
          <span className={styles.legendDot} style={{ background: "var(--blue)" }} />
          {t.legendCounter}
        </span>
        <span>
          <span className={styles.legendDot} style={{ background: "var(--green)" }} />
          {t.legendSynergy}
        </span>
        <span>
          <span className={styles.legendDot} style={{ background: "var(--accent)" }} />
          {t.legendMap}
        </span>
      </div>

      {recommendations.map((rec, i) => {
        const { counter, synergy, map } = rec.score_breakdown;
        // 음수 점수(맵 "약함", 또는 상대가 이 후보를 카운터하는 경우의 counter)는
        // 막대에 표시할 게 없으니 0으로 취급
        const positiveCounter = Math.max(counter, 0);
        const positiveMap = Math.max(map, 0);
        const total = positiveCounter + synergy + positiveMap;
        const counterPct = total > 0 ? (positiveCounter / total) * 100 : 0;
        const synergyPct = total > 0 ? (synergy / total) * 100 : 0;
        const mapPct = total > 0 ? (positiveMap / total) * 100 : 0;

        const isHighlighted = i === 0 || rec.is_must_pick;

        return (
          <div key={rec.hero_id} className={`${styles.row} ${i === 0 ? styles.rowTop1 : ""}`}>
            <div className={styles.rank}>{i + 1}</div>
            <HeroAvatar
              iconUrl={rec.icon_url}
              name={rec.hero_name}
              variant="portrait"
              highlighted={isHighlighted}
            />
            <div className={styles.main}>
              <div className={styles.nameRow}>
                <span className={styles.heroName}>{rec.hero_name}</span>
                {rec.is_must_pick && <span className={styles.mustPickBadge}>{t.mustPickBadge}</span>}
                <span className={styles.percentage}>{t.recommendationScore(rec.percentage)}</span>
              </div>
              <div className={styles.archetype}>
                {ROLE_LABEL[locale][rec.role]} · {rec.archetype}
              </div>
              <div className={styles.pctBarTrack}>
                <div className={styles.pctBarFill} style={{ width: `${rec.percentage}%` }} />
              </div>
              {total > 0 && (
                <div className={styles.breakdownBar}>
                  {counterPct > 0 && (
                    <div style={{ width: `${counterPct}%`, background: "var(--blue)" }} />
                  )}
                  {synergyPct > 0 && (
                    <div style={{ width: `${synergyPct}%`, background: "var(--green)" }} />
                  )}
                  {mapPct > 0 && (
                    <div style={{ width: `${mapPct}%`, background: "var(--accent)" }} />
                  )}
                </div>
              )}
              <div className={styles.reasons}>
                {rec.reasons.map((reason, idx) => (
                  <span key={idx} className={styles.tag}>
                    {reason}
                  </span>
                ))}
                {/* notes: 아직 큐레이션된 데이터가 없어 항상 빈 배열이지만, 목업의
                    무채색(text-tertiary) 톤 태그와 맞춰 미리 렌더링 경로를 마련해둠. */}
                {rec.notes.map((note, idx) => (
                  <span key={`note-${idx}`} className={styles.noteTag}>
                    {note}
                  </span>
                ))}
                {rec.data_gaps.map((gap, idx) => (
                  <span key={`gap-${idx}`} className={`${styles.noteTag} ${styles.dataGapTag}`}>
                    {t.noDataPrefix}
                    {gap}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
