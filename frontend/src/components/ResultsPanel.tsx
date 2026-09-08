import type { HeroRecommendation } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/types";
import styles from "./ResultsPanel.module.css";

interface Props {
  recommendations: HeroRecommendation[];
  notice: string | null;
}

export function ResultsPanel({ recommendations, notice }: Props) {
  return (
    <div>
      {notice && <div className={styles.notice}>{notice}</div>}

      <div className={styles.legend}>
        <span>
          <span className={styles.legendDot} style={{ background: "var(--blue)" }} />
          카운터
        </span>
        <span>
          <span className={styles.legendDot} style={{ background: "var(--green)" }} />
          시너지
        </span>
        <span>
          <span className={styles.legendDot} style={{ background: "var(--accent)" }} />
          맵
        </span>
      </div>

      {recommendations.map((rec, i) => {
        const { counter, synergy, map } = rec.score_breakdown;
        // 음수 맵 점수(약함)는 막대에 표시할 게 없으니 0으로 취급
        const positiveMap = Math.max(map, 0);
        const total = counter + synergy + positiveMap;
        const counterPct = total > 0 ? (counter / total) * 100 : 0;
        const synergyPct = total > 0 ? (synergy / total) * 100 : 0;
        const mapPct = total > 0 ? (positiveMap / total) * 100 : 0;

        const isHighlighted = i === 0 || rec.is_must_pick;

        return (
          <div key={rec.hero_id} className={`${styles.row} ${i === 0 ? styles.rowTop1 : ""}`}>
            <div className={styles.rank}>{i + 1}</div>
            {rec.icon_url ? (
              <img
                src={rec.icon_url}
                alt=""
                className={`${styles.portrait} ${isHighlighted ? styles.portraitHighlight : ""}`}
              />
            ) : (
              <div
                className={`${styles.portraitFallback} ${
                  isHighlighted ? styles.portraitHighlight : ""
                }`}
              >
                {rec.hero_name[0]}
              </div>
            )}
            <div className={styles.main}>
              <div className={styles.nameRow}>
                <span className={styles.heroName}>{rec.hero_name}</span>
                {rec.is_must_pick && <span className={styles.mustPickBadge}>필수픽</span>}
                <span className={styles.percentage}>{rec.percentage}%</span>
              </div>
              <div className={styles.archetype}>
                {ROLE_LABEL[rec.role]} · {rec.archetype}
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
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
