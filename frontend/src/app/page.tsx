"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import { SharedHeroGrid } from "@/components/SharedHeroGrid";
import type { Team } from "@/components/SharedHeroGrid";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MapPickerModal } from "@/components/MapPickerModal";
import { ResultsPanel } from "@/components/ResultsPanel";
import { ErrorScreen } from "@/components/ErrorScreen";
import { fetchHeroes, fetchMaps, fetchMeta, postRecommendations, ApiValidationError } from "@/lib/api";
import type { Hero, MapInfo, MetaInfo, RecommendationResponse, Role } from "@/lib/types";
import { modeLabel } from "@/lib/types";

const OUR_TEAM_SIZE = 4;
// 오버워치 역할 고정 큐 표준 조합(탱커1·딜러2·힐러2) — backend/app/config.py의
// TEAM_ROLE_COMPOSITION과 동일 값. 선택창 자체에서 이 정원을 넘는 역할은
// 고를 수 없게 막아서, 애초에 표준 조합이 아닌 팀 구성이 만들어지지 않게 한다.
const TEAM_ROLE_LIMITS: Record<Role, number> = { tank: 1, damage: 2, support: 2 };

type CatalogState = "loading" | "ready" | "error";
type SubmitPhase = "idle" | "loading" | "success" | "error";

export default function Home() {
  const [catalogState, setCatalogState] = useState<CatalogState>("loading");
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [maps, setMaps] = useState<MapInfo[]>([]);
  const [meta, setMeta] = useState<MetaInfo | null>(null);

  const [enemyHeroes, setEnemyHeroes] = useState<string[]>([]);
  const [ourHeroes, setOurHeroes] = useState<string[]>([]);
  const [mapId, setMapId] = useState<string | null>(null);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [activeTeam, setActiveTeam] = useState<Team>("enemy");

  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>("idle");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendationResponse | null>(null);

  // 우리 팀 4명 + 맵이 다 채워지면 버튼 없이 바로 추천을 보여준다. 이 입력
  // 조합으로 이미 요청을 보낸 적 있으면(예: "입력으로 돌아가기"만 누르고 아무것도
  // 안 바꿨을 때) 똑같은 요청을 또 자동으로 쏘지 않도록 마지막으로 제출한
  // 입력의 서명을 기억해둔다.
  const lastSubmittedKeyRef = useRef<string | null>(null);

  async function loadCatalog() {
    try {
      const [heroList, mapList] = await Promise.all([fetchHeroes(), fetchMaps()]);
      setHeroes(heroList);
      setMaps(mapList);
      setCatalogState("ready");
    } catch {
      setCatalogState("error");
      return;
    }
    // 헤더의 "시즌 4 시드 데이터 · v0.3" 배지는 핵심 기능이 아니므로, 실패해도
    // 위의 catalogState는 건드리지 않고 그냥 배지만 안 보여준다.
    try {
      setMeta(await fetchMeta());
    } catch {
      setMeta(null);
    }
  }

  function retryLoadCatalog() {
    setCatalogState("loading");
    loadCatalog();
  }

  useEffect(() => {
    // 마운트 시 1회 데이터 로딩(표준 패턴). loadCatalog 내부의 setState는 항상
    // await 이후(네트워크 응답 후)에만 호출되므로 실제 cascading render 문제는 없음.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCatalog();
  }, []);

  async function handleSubmit() {
    setValidationMessage(null);
    setSubmitPhase("loading");
    try {
      const res = await postRecommendations({
        enemy_heroes: enemyHeroes,
        our_heroes: ourHeroes,
        map_id: mapId!,
      });
      setResult(res);
      setSubmitPhase("success");
    } catch (err) {
      if (err instanceof ApiValidationError) {
        setValidationMessage(err.message);
        setSubmitPhase("idle");
      } else {
        setSubmitPhase("error");
      }
    }
  }

  useEffect(() => {
    if (catalogState !== "ready") return;
    if (ourHeroes.length !== OUR_TEAM_SIZE || !mapId) return;
    if (submitPhase === "loading") return;

    const key = JSON.stringify({
      enemy: [...enemyHeroes].sort(),
      our: [...ourHeroes].sort(),
      mapId,
    });
    if (lastSubmittedKeyRef.current === key) return;

    lastSubmittedKeyRef.current = key;
    handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogState, enemyHeroes, ourHeroes, mapId, submitPhase]);

  useEffect(() => {
    if (submitPhase === "success") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [submitPhase]);

  const selectedMap = maps.find((m) => m.id === mapId) ?? null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.wordmark}>
          COUNTERPICK<span className={styles.wordmarkAccent}>.GG</span>
        </span>
        <div className={styles.headerRight}>
          {meta && (
            <span className={styles.metaBadge}>
              <span className={styles.metaBadgeDot} />
              {meta.season} 시드 데이터 · {meta.data_version}
            </span>
          )}
          <ThemeToggle />
        </div>
      </div>

      {catalogState === "loading" && <div className={styles.centerNote}>불러오는 중...</div>}

      {catalogState === "error" && <ErrorScreen onRetry={retryLoadCatalog} />}

      {catalogState === "ready" && submitPhase !== "error" && submitPhase !== "success" && (
        <>
          <div className={styles.section}>
            <SharedHeroGrid
              heroes={heroes}
              activeTeam={activeTeam}
              onChangeActiveTeam={setActiveTeam}
              enemyIds={enemyHeroes}
              ourIds={ourHeroes}
              enemyMax={5}
              ourMax={OUR_TEAM_SIZE}
              roleLimits={TEAM_ROLE_LIMITS}
              onChangeEnemy={setEnemyHeroes}
              onChangeOur={setOurHeroes}
            />
          </div>

          <div className={styles.section}>
            <span className={styles.sectionLabel}>맵</span>
            <button
              type="button"
              className={styles.mapButton}
              onClick={() => setMapPickerOpen(true)}
            >
              {selectedMap ? (
                `${selectedMap.name} · ${modeLabel(selectedMap.mode)}`
              ) : (
                <span className={styles.mapButtonPlaceholder}>맵을 선택해주세요</span>
              )}
            </button>
          </div>

          {validationMessage && <div className={styles.errorText}>{validationMessage}</div>}

          {submitPhase === "loading" && (
            <div className={styles.centerNote}>분석 중...</div>
          )}

          {mapPickerOpen && (
            <MapPickerModal
              maps={maps}
              selectedId={mapId}
              onSelect={setMapId}
              onClose={() => setMapPickerOpen(false)}
            />
          )}
        </>
      )}

      {submitPhase === "error" && <ErrorScreen onRetry={handleSubmit} />}

      {submitPhase === "success" && result && (
        <>
          <ResultsPanel
            recommendations={result.recommendations}
            emptyPosition={result.empty_position}
            notice={result.notice}
          />
          <button type="button" className={styles.resetLink} onClick={() => setSubmitPhase("idle")}>
            ← 입력으로 돌아가기
          </button>
        </>
      )}
    </div>
  );
}
