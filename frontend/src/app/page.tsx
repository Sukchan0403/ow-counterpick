"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { HeroPickerPanel } from "@/components/HeroPickerPanel";
import { RoleSelectPanel } from "@/components/RoleSelectPanel";
import { MapPickerModal } from "@/components/MapPickerModal";
import { ResultsPanel } from "@/components/ResultsPanel";
import { ErrorScreen } from "@/components/ErrorScreen";
import { fetchHeroes, fetchMaps, fetchMeta, postRecommendations, ApiValidationError } from "@/lib/api";
import type { Hero, MapInfo, MetaInfo, Role, RecommendationResponse } from "@/lib/types";
import { modeLabel } from "@/lib/types";

type CatalogState = "loading" | "ready" | "error";
type SubmitPhase = "idle" | "loading" | "success" | "error";

export default function Home() {
  const [catalogState, setCatalogState] = useState<CatalogState>("loading");
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [maps, setMaps] = useState<MapInfo[]>([]);
  const [meta, setMeta] = useState<MetaInfo | null>(null);

  const [enemyHeroes, setEnemyHeroes] = useState<string[]>([]);
  const [ourHeroes, setOurHeroes] = useState<string[]>([]);
  const [emptyPosition, setEmptyPosition] = useState<Role | null>(null);
  const [mapId, setMapId] = useState<string | null>(null);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
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
    if (!emptyPosition || !mapId) {
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
        empty_position: emptyPosition,
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
          <div className={styles.grid}>
            <HeroPickerPanel
              title="상대 팀 픽"
              heroes={heroes}
              selectedIds={enemyHeroes}
              maxCount={5}
              onChange={setEnemyHeroes}
            />
            <HeroPickerPanel
              title="우리 팀 픽"
              heroes={heroes}
              selectedIds={ourHeroes}
              maxCount={4}
              onChange={setOurHeroes}
            />
          </div>

          <div className={styles.section}>
            <span className={styles.sectionLabel}>빈 포지션</span>
            <RoleSelectPanel
              value={emptyPosition}
              onChange={setEmptyPosition}
              hasError={showValidation}
            />
            {showValidation && !emptyPosition && (
              <div className={styles.errorText}>빈 포지션을 선택해주세요.</div>
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
          <ResultsPanel recommendations={result.recommendations} notice={result.notice} />
          <button type="button" className={styles.resetLink} onClick={() => setSubmitPhase("idle")}>
            ← 입력으로 돌아가기
          </button>
        </>
      )}
    </div>
  );
}
