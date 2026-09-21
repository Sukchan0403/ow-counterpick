"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/app/page.module.css";
import { SharedHeroGrid } from "@/components/SharedHeroGrid";
import type { Team } from "@/components/SharedHeroGrid";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MapPickerModal } from "@/components/MapPickerModal";
import { ResultsPanel } from "@/components/ResultsPanel";
import { ErrorScreen } from "@/components/ErrorScreen";
import { fetchHeroes, fetchMaps, fetchMeta, postRecommendations, ApiValidationError } from "@/lib/api";
import type { Hero, MapInfo, MetaInfo, RecommendationResponse, Role } from "@/lib/types";
import type { Locale } from "@/lib/i18n";
import { LOCALE_HTML_LANG, getDictionary, modeLabel } from "@/lib/i18n";

const OUR_TEAM_SIZE = 4;
const ENEMY_TEAM_SIZE = 5;

// 언어 스위처는 로케일별 별도 라우트(/,/en,/ja,/zh-cn,/zh-tw)로 이동하는 일반
// <Link>라서(SEO를 위해 의도적으로 이렇게 만듦 — LanguageSwitcher 참고), 언어를
// 바꾸면 HomeClient가 통째로 새로 마운트되어 팀 선택이 초기화된다. hero_id/map_id는
// 언어와 무관한 값이라 sessionStorage에 저장해두고 마운트마다 복원하면, 언어를
// 바꿔도 같은 조합을 그대로 이어서(다른 언어로) 볼 수 있다. 탭을 닫으면 사라지는
// sessionStorage를 쓰는 이유는 "다음에 다시 왔을 때도 예전 조합이 남아있는" 걸
// 원치 않기 때문 — 같은 세션 안에서의 언어 전환만 지원하면 충분하다.
const SELECTION_STORAGE_KEY = "ow-counterpick:selection";

interface StoredSelection {
  enemyHeroes: string[];
  ourHeroes: string[];
  mapId: string | null;
  activeTeam: Team;
}

function loadStoredSelection(): StoredSelection | null {
  try {
    const raw = sessionStorage.getItem(SELECTION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSelection;
  } catch {
    return null;
  }
}

function saveStoredSelection(selection: StoredSelection) {
  try {
    sessionStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // 프라이빗 모드 등에서 막혀있어도 조용히 무시 — 저장 안 되는 것뿐 기능은 그대로 동작
  }
}
// 오버워치 역할 고정 큐 표준 조합(탱커1·딜러2·힐러2) — backend/app/config.py의
// TEAM_ROLE_COMPOSITION과 동일 값. 선택창 자체에서 이 정원을 넘는 역할은
// 고를 수 없게 막아서, 애초에 표준 조합이 아닌 팀 구성이 만들어지지 않게 한다.
const TEAM_ROLE_LIMITS: Record<Role, number> = { tank: 1, damage: 2, support: 2 };

type CatalogState = "loading" | "ready" | "error";
type SubmitPhase = "idle" | "loading" | "success" | "error";

export function HomeClient({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);

  // <html lang>은 layout.tsx가 한 번만 렌더링해서 항상 "ko"로 고정돼 있으니,
  // /en·/ja 페이지에서는 마운트 후 실제 로케일로 맞춰준다 — 접근성/SEO용 속성이라
  // 서버 렌더링 결과와 잠깐 다를 수 있는 건 감수(레이아웃을 로케일별로 쪼개는 것보단
  // 훨씬 단순한 절충).
  useEffect(() => {
    document.documentElement.lang = LOCALE_HTML_LANG[locale];
  }, [locale]);

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

  // 언어 전환으로 이 컴포넌트가 새로 마운트돼도 팀 선택이 유지되도록, 마운트 시
  // sessionStorage에서 복원한다. ThemeToggle과 같은 이유로 초기 렌더(서버/클라
  // 공통)는 항상 빈 값으로 시작하고, 실제 복원은 마운트 이후 useEffect에서
  // 한다 — useState 초기값에서 바로 sessionStorage를 읽으면 서버 렌더링 결과와
  // 달라져 하이드레이션 미스매치가 난다.
  useEffect(() => {
    const stored = loadStoredSelection();
    if (!stored) return;
    // 마운트 시 1회 외부 저장소(sessionStorage)에서 동기화하는 초기화 로직 — cascading render 아님
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnemyHeroes(stored.enemyHeroes);
    setOurHeroes(stored.ourHeroes);
    setMapId(stored.mapId);
    setActiveTeam(stored.activeTeam);
  }, []);

  useEffect(() => {
    saveStoredSelection({ enemyHeroes, ourHeroes, mapId, activeTeam });
  }, [enemyHeroes, ourHeroes, mapId, activeTeam]);

  // 우리 팀 4명 + 상대 팀 5명 + 맵이 다 채워지면 버튼 없이 바로 추천을 보여준다.
  // 이 입력 조합으로 이미 요청을 보낸 적 있으면(예: "입력으로 돌아가기"만 누르고
  // 아무것도 안 바꿨을 때) 똑같은 요청을 또 자동으로 쏘지 않도록 마지막으로 제출한
  // 입력의 서명을 기억해둔다.
  const lastSubmittedKeyRef = useRef<string | null>(null);

  async function loadCatalog() {
    try {
      const [heroList, mapList] = await Promise.all([fetchHeroes(locale), fetchMaps(locale)]);
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
      setMeta(await fetchMeta(locale));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit() {
    setValidationMessage(null);
    setSubmitPhase("loading");
    try {
      const res = await postRecommendations(
        {
          enemy_heroes: enemyHeroes,
          our_heroes: ourHeroes,
          map_id: mapId!,
        },
        locale,
      );
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
    // 우리 팀뿐 아니라 상대 팀도 5명이 다 채워졌을 때만 자동 제출한다 — 이 조건이
    // 없으면 결과 화면에서 "입력으로 돌아가기"로 나온 뒤 상대 픽 하나를 지우는
    // 순간(우리 팀·맵은 그대로 채워진 상태) 바로 다시 추천으로 넘어가버린다.
    if (ourHeroes.length !== OUR_TEAM_SIZE || enemyHeroes.length !== ENEMY_TEAM_SIZE || !mapId) return;
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
              {t.metaBadge(meta.season, meta.data_version)}
            </span>
          )}
          <LanguageSwitcher locale={locale} />
          <ThemeToggle locale={locale} />
        </div>
      </div>

      {catalogState === "loading" && <div className={styles.centerNote}>{t.loading}</div>}

      {catalogState === "error" && <ErrorScreen onRetry={retryLoadCatalog} locale={locale} />}

      {catalogState === "ready" && submitPhase !== "error" && submitPhase !== "success" && (
        <>
          <div className={styles.section}>
            <SharedHeroGrid
              heroes={heroes}
              activeTeam={activeTeam}
              onChangeActiveTeam={setActiveTeam}
              enemyIds={enemyHeroes}
              ourIds={ourHeroes}
              enemyMax={ENEMY_TEAM_SIZE}
              ourMax={OUR_TEAM_SIZE}
              roleLimits={TEAM_ROLE_LIMITS}
              onChangeEnemy={setEnemyHeroes}
              onChangeOur={setOurHeroes}
              locale={locale}
            />
          </div>

          <div className={styles.section}>
            <span className={styles.sectionLabel}>{t.mapSectionLabel}</span>
            <button
              type="button"
              className={styles.mapButton}
              onClick={() => setMapPickerOpen(true)}
            >
              {selectedMap ? (
                `${selectedMap.name} · ${modeLabel(locale, selectedMap.mode)}`
              ) : (
                <span className={styles.mapButtonPlaceholder}>{t.mapPlaceholder}</span>
              )}
            </button>
          </div>

          {validationMessage && <div className={styles.errorText}>{validationMessage}</div>}

          {submitPhase === "loading" && (
            <div className={styles.centerNote}>{t.analyzing}</div>
          )}

          {mapPickerOpen && (
            <MapPickerModal
              maps={maps}
              selectedId={mapId}
              onSelect={setMapId}
              onClose={() => setMapPickerOpen(false)}
              locale={locale}
            />
          )}
        </>
      )}

      {submitPhase === "error" && <ErrorScreen onRetry={handleSubmit} locale={locale} />}

      {submitPhase === "success" && result && (
        <>
          <ResultsPanel
            recommendations={result.recommendations}
            emptyPosition={result.empty_position}
            notice={result.notice}
            locale={locale}
          />
          <button type="button" className={styles.resetLink} onClick={() => setSubmitPhase("idle")}>
            {t.backToInput}
          </button>
        </>
      )}
    </div>
  );
}
