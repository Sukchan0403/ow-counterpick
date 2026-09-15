"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { SharedHeroGrid } from "@/components/SharedHeroGrid";
import type { Team } from "@/components/SharedHeroGrid";
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
  const [showValidation, setShowValidation] = useState(false);

  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>("idle");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendationResponse | null>(null);

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
    if (ourHeroes.length !== OUR_TEAM_SIZE || !mapId) {
      setShowValidation(true);
      return;
    }
    setShowValidation(false);
    setValidationMessage(null);
    setSubmitPhase("loading");
    try {
      const res = await postRecommendations({
        enemy_heroes: enemyHeroes,
        our_heroes: ourHeroes,
        map_id: mapId,
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

  const selectedMap = maps.find((m) => m.id === mapId) ?? null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.wordmark}>
          COUNTERPICK<span className={styles.wordmarkAccent}>.GG</span>
        </span>
        {meta && (
          <span className={styles.metaBadge}>
            <span className={styles.metaBadgeDot} />
            {meta.season} 시드 데이터 · {meta.data_version}
          </span>
        )}
      </div>
      <div className={styles.subtitle}>실시간 밴프준 보조 (개인 포트폴리오 프로젝트)</div>

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
              ourHasError={showValidation && ourHeroes.length !== OUR_TEAM_SIZE}
            />
            {showValidation && ourHeroes.length !== OUR_TEAM_SIZE && (
              <div className={styles.errorText}>
                우리 팀 픽 4명을 모두 선택해주세요 — 남은 포지션은 자동으로 판단됩니다.
              </div>
            )}
          </div>

          <div className={styles.section}>
            <span className={styles.sectionLabel}>맵</span>
            <button
              type="button"
              className={`${styles.mapButton} ${
                showValidation && !mapId ? styles.mapButtonError : ""
              }`}
              onClick={() => setMapPickerOpen(true)}
            >
              {selectedMap ? (
                `${selectedMap.name} · ${modeLabel(selectedMap.mode)}`
              ) : (
                <span className={styles.mapButtonPlaceholder}>맵을 선택해주세요</span>
              )}
            </button>
            {showValidation && !mapId && (
              <div className={styles.errorText}>맵을 선택해주세요.</div>
            )}
          </div>

          {validationMessage && <div className={styles.errorText}>{validationMessage}</div>}

          <button
            type="button"
            className={styles.submitButton}
            onClick={handleSubmit}
            disabled={submitPhase === "loading"}
          >
            {submitPhase === "loading" ? "분석 중..." : "추천 영웅 보기"}
          </button>

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
