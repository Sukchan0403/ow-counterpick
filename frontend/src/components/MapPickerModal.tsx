import type { DataRichness, MapInfo } from "@/lib/types";
import { RICHNESS_LABEL, modeLabel } from "@/lib/types";
import { colorForMap } from "@/lib/mapColors";
import styles from "./MapPickerModal.module.css";

interface Props {
  maps: MapInfo[];
  selectedId: string | null;
  onSelect: (mapId: string) => void;
  onClose: () => void;
}

// 목업(MapPicker.dc.html)의 "데이터 풍부"/"데이터 보강 중" 태그는 맵 하나하나가 아니라
// 모드 그룹 헤더에 붙는다. 그룹 안에 데이터가 부족한(growing) 맵이 하나라도 있으면
// 그룹 전체를 "growing"으로 표시(과신 방지 — 보수적으로 표시).
function groupRichness(modeMaps: MapInfo[]): DataRichness {
  return modeMaps.every((m) => m.data_richness === "rich") ? "rich" : "growing";
}

export function MapPickerModal({ maps, selectedId, onSelect, onClose }: Props) {
  const modes = Array.from(new Set(maps.map((m) => m.mode)));

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>맵 선택</span>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        {modes.map((mode) => {
          const modeMaps = maps.filter((m) => m.mode === mode);
          const richness = groupRichness(modeMaps);
          return (
            <div key={mode} className={styles.modeSection}>
              <div className={styles.modeHeader}>
                <span>
                  {modeLabel(mode)} · {modeMaps.length}개
                </span>
                <span
                  className={`${styles.dataTag} ${
                    richness === "rich" ? styles.dataTagRich : styles.dataTagGrowing
                  }`}
                >
                  {RICHNESS_LABEL[richness]}
                </span>
              </div>
              <div className={styles.grid}>
                {modeMaps.map((map) => (
                  <div
                    key={map.id}
                    className={`${styles.card} ${
                      selectedId === map.id ? styles.cardSelected : ""
                    }`}
                    style={{
                      background: `linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.55) 100%), ${colorForMap(
                        map.id,
                      )}`,
                    }}
                    onClick={() => {
                      onSelect(map.id);
                      onClose();
                    }}
                  >
                    {map.name}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
