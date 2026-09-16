// 다국어 지원(한국어/영어/일본어). 이 파일에 있는 문구는 전부 프론트엔드 UI가
// 직접 조립하는 텍스트다 — 영웅 이름/근거(reason)/맵 이름처럼 DB에서 오는 값은
// 여기 안 두고, 백엔드에 lang 파라미터로 보내서 받은 값을 그대로 쓴다
// (lib/api.ts, app/[locale 페이지]들 참고).
import type { Role, DataRichness } from "./types";

export type Locale = "ko" | "en" | "ja";

export const LOCALES: Locale[] = ["ko", "en", "ja"];

export const LOCALE_LABEL: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
};

// html lang 속성, Open Graph locale 등에 쓰는 BCP47 태그.
export const LOCALE_HTML_LANG: Record<Locale, string> = {
  ko: "ko",
  en: "en",
  ja: "ja",
};

interface Dictionary {
  loading: string;
  analyzing: string;
  mapSectionLabel: string;
  mapPlaceholder: string;
  backToInput: string;
  metaBadge: (season: string, dataVersion: string) => string;

  // SharedHeroGrid
  enemyTeam: string;
  ourTeam: string;
  teamCount: (count: number, max: number) => string;
  uncategorized: string;

  // MapPickerModal
  mapPickerTitle: string;
  close: string;
  mapCount: (count: number) => string;

  // ResultsPanel
  inferredPositionPrefix: string;
  legendCounter: string;
  legendSynergy: string;
  legendMap: string;
  mustPickBadge: string;
  recommendationScore: (percentage: number) => string;
  noDataPrefix: string;

  // ErrorScreen
  errorHeading: string;
  errorSubtext: string;
  retry: string;

  // ThemeToggle
  switchToLight: string;
  switchToDark: string;

  // lib/api.ts 실패 메시지 (백엔드가 명시적으로 내려주는 detail 문구는 이 범위 밖 —
  // 그건 배포 초기 단계라 한국어 사용자 기준으로만 다듬어져 있음)
  apiInvalidInput: string;
  apiServerErrorStatus: (status: number) => string;
  apiHeroesLoadFailed: string;
  apiMapsLoadFailed: string;
  apiRecommendationsFailed: string;
}

const ko: Dictionary = {
  loading: "불러오는 중...",
  analyzing: "분석 중...",
  mapSectionLabel: "맵",
  mapPlaceholder: "맵을 선택해주세요",
  backToInput: "← 입력으로 돌아가기",
  metaBadge: (season, dataVersion) => `${season} 시드 데이터 · ${dataVersion}`,

  enemyTeam: "상대 팀",
  ourTeam: "우리 팀",
  teamCount: (count, max) => `${count}/${max}`,
  uncategorized: "기타",

  mapPickerTitle: "맵 선택",
  close: "닫기",
  mapCount: (count) => `${count}개`,

  inferredPositionPrefix: "부족한 포지션 · ",
  legendCounter: "카운터",
  legendSynergy: "시너지",
  legendMap: "맵",
  mustPickBadge: "필수픽",
  recommendationScore: (percentage) => `추천 지수 ${percentage}`,
  noDataPrefix: "데이터 없음 · ",

  errorHeading: "일시적인 오류가 발생했어요",
  errorSubtext: "오류 코드 502 · BAD GATEWAY",
  retry: "다시 시도",

  switchToLight: "라이트 모드로 전환",
  switchToDark: "다크 모드로 전환",

  apiInvalidInput: "입력값을 확인해주세요.",
  apiServerErrorStatus: (status) => `서버 오류 (status ${status})`,
  apiHeroesLoadFailed: "영웅 목록을 불러오지 못했어요.",
  apiMapsLoadFailed: "맵 목록을 불러오지 못했어요.",
  apiRecommendationsFailed: "추천 결과를 받아오지 못했어요.",
};

const en: Dictionary = {
  loading: "Loading...",
  analyzing: "Analyzing...",
  mapSectionLabel: "Map",
  mapPlaceholder: "Select a map",
  backToInput: "← Back to picks",
  metaBadge: (season, dataVersion) => `${season} seed data · ${dataVersion}`,

  enemyTeam: "Enemy team",
  ourTeam: "Our team",
  teamCount: (count, max) => `${count}/${max}`,
  uncategorized: "Other",

  mapPickerTitle: "Select a map",
  close: "Close",
  mapCount: (count) => `${count} maps`,

  inferredPositionPrefix: "Open position · ",
  legendCounter: "Counter",
  legendSynergy: "Synergy",
  legendMap: "Map",
  mustPickBadge: "Must-pick",
  recommendationScore: (percentage) => `Score ${percentage}`,
  noDataPrefix: "No data · ",

  errorHeading: "Something went wrong",
  errorSubtext: "Error code 502 · BAD GATEWAY",
  retry: "Retry",

  switchToLight: "Switch to light mode",
  switchToDark: "Switch to dark mode",

  apiInvalidInput: "Please check your input.",
  apiServerErrorStatus: (status) => `Server error (status ${status})`,
  apiHeroesLoadFailed: "Couldn't load the hero list.",
  apiMapsLoadFailed: "Couldn't load the map list.",
  apiRecommendationsFailed: "Couldn't get a recommendation.",
};

const ja: Dictionary = {
  loading: "読み込み中...",
  analyzing: "分析中...",
  mapSectionLabel: "マップ",
  mapPlaceholder: "マップを選択してください",
  backToInput: "← 選択画面に戻る",
  metaBadge: (season, dataVersion) => `${season} シードデータ · ${dataVersion}`,

  enemyTeam: "敵チーム",
  ourTeam: "味方チーム",
  teamCount: (count, max) => `${count}/${max}`,
  uncategorized: "その他",

  mapPickerTitle: "マップ選択",
  close: "閉じる",
  mapCount: (count) => `${count}種類`,

  inferredPositionPrefix: "不足しているポジション · ",
  legendCounter: "カウンター",
  legendSynergy: "シナジー",
  legendMap: "マップ",
  mustPickBadge: "必須ピック",
  recommendationScore: (percentage) => `おすすめ度 ${percentage}`,
  noDataPrefix: "データなし · ",

  errorHeading: "一時的なエラーが発生しました",
  errorSubtext: "エラーコード 502 · BAD GATEWAY",
  retry: "再試行",

  switchToLight: "ライトモードに切り替え",
  switchToDark: "ダークモードに切り替え",

  apiInvalidInput: "入力内容をご確認ください。",
  apiServerErrorStatus: (status) => `サーバーエラー (status ${status})`,
  apiHeroesLoadFailed: "ヒーロー一覧を読み込めませんでした。",
  apiMapsLoadFailed: "マップ一覧を読み込めませんでした。",
  apiRecommendationsFailed: "おすすめ結果を取得できませんでした。",
};

export const DICTIONARIES: Record<Locale, Dictionary> = { ko, en, ja };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

// 백엔드 role은 언어와 무관한 내부 식별자("tank"/"damage"/"support")라, 표시할 땐
// 로케일별로 번역한다.
export const ROLE_LABEL: Record<Locale, Record<Role, string>> = {
  ko: { tank: "돌격", damage: "공격", support: "지원" },
  en: { tank: "Tank", damage: "Damage", support: "Support" },
  ja: { tank: "タンク", damage: "ダメージ", support: "サポート" },
};

// 백엔드 maps.mode는 영문 enum 그대로 온다 — 표시할 때만 번역.
export const MODE_LABEL: Record<Locale, Record<string, string>> = {
  ko: {
    hybrid: "혼합", escort: "호위", control: "점령",
    clash: "격돌", push: "밀기", flashpoint: "플래시포인트",
  },
  en: {
    hybrid: "Hybrid", escort: "Escort", control: "Control",
    clash: "Clash", push: "Push", flashpoint: "Flashpoint",
  },
  ja: {
    hybrid: "混合", escort: "護送", control: "制圧",
    clash: "衝突", push: "押し出し", flashpoint: "フラッシュポイント",
  },
};

export function modeLabel(locale: Locale, mode: string): string {
  return MODE_LABEL[locale][mode] ?? mode;
}

export const RICHNESS_LABEL: Record<Locale, Record<DataRichness, string>> = {
  ko: { rich: "데이터 풍부", growing: "데이터 보강 중" },
  en: { rich: "Rich data", growing: "Data growing" },
  ja: { rich: "データ充実", growing: "データ拡充中" },
};

// heroes.archetype_category는 백엔드가 항상 한국어 원본 값(예: "개시자")을
// 내부 식별자로 내려준다(seed-data/seed_db.py의 ALLOWED_ARCHETYPE_CATEGORIES
// 참고 — 그룹핑 키라서 lang을 안 탄다). 화면에 보여줄 때만 로케일별로 번역한다.
export const ARCHETYPE_CATEGORY_LABEL: Record<Locale, Record<string, string>> = {
  ko: {
    "개시자": "개시자", "투사": "투사", "강건한 자": "강건한 자",
    "전문가": "전문가", "수색가": "수색가", "측면 공격가": "측면 공격가", "명사수": "명사수",
    "전술가": "전술가", "의무관": "의무관", "생존왕": "생존왕",
  },
  en: {
    "개시자": "Vanguard", "투사": "Brawler", "강건한 자": "Juggernaut",
    "전문가": "Specialist", "수색가": "Scout", "측면 공격가": "Flanker", "명사수": "Marksman",
    "전술가": "Tactician", "의무관": "Combat Medic", "생존왕": "Survivor",
  },
  ja: {
    "개시자": "先駆者", "투사": "闘士", "강건한 자": "重戦士",
    "전문가": "スペシャリスト", "수색가": "偵察兵", "측면 공격가": "フランカー", "명사수": "マークスマン",
    "전술가": "戦術家", "의무관": "衛生兵", "생존왕": "サバイバー",
  },
};

export function archetypeCategoryLabel(locale: Locale, category: string): string {
  return ARCHETYPE_CATEGORY_LABEL[locale][category] ?? category;
}
