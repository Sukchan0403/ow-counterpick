// 다국어 지원(한국어/영어/일본어). 이 파일에 있는 문구는 전부 프론트엔드 UI가
// 직접 조립하는 텍스트다 — 영웅 이름/근거(reason)/맵 이름처럼 DB에서 오는 값은
// 여기 안 두고, 백엔드에 lang 파라미터로 보내서 받은 값을 그대로 쓴다
// (lib/api.ts, app/[locale 페이지]들 참고).
import type { Role, DataRichness } from "./types";

export type Locale = "ko" | "en" | "ja" | "zh-cn" | "zh-tw";

export const LOCALES: Locale[] = ["ko", "en", "ja", "zh-cn", "zh-tw"];

export const LOCALE_LABEL: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  "zh-cn": "简体中文",
  "zh-tw": "繁體中文",
};

// html lang 속성, Open Graph locale 등에 쓰는 BCP47 태그.
export const LOCALE_HTML_LANG: Record<Locale, string> = {
  ko: "ko",
  en: "en",
  ja: "ja",
  "zh-cn": "zh-Hans",
  "zh-tw": "zh-Hant",
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

const zhCn: Dictionary = {
  loading: "加载中...",
  analyzing: "分析中...",
  mapSectionLabel: "地图",
  mapPlaceholder: "请选择地图",
  backToInput: "← 返回选择",
  metaBadge: (season, dataVersion) => `${season} 种子数据 · ${dataVersion}`,

  enemyTeam: "敌方队伍",
  ourTeam: "我方队伍",
  teamCount: (count, max) => `${count}/${max}`,
  uncategorized: "其他",

  mapPickerTitle: "选择地图",
  close: "关闭",
  mapCount: (count) => `${count}张`,

  inferredPositionPrefix: "缺少的位置 · ",
  legendCounter: "克制",
  legendSynergy: "配合",
  legendMap: "地图",
  mustPickBadge: "必选",
  recommendationScore: (percentage) => `推荐指数 ${percentage}`,
  noDataPrefix: "暂无数据 · ",

  errorHeading: "发生了临时错误",
  errorSubtext: "错误代码 502 · BAD GATEWAY",
  retry: "重试",

  switchToLight: "切换到浅色模式",
  switchToDark: "切换到深色模式",

  apiInvalidInput: "请检查输入内容。",
  apiServerErrorStatus: (status) => `服务器错误 (状态码 ${status})`,
  apiHeroesLoadFailed: "无法加载英雄列表。",
  apiMapsLoadFailed: "无法加载地图列表。",
  apiRecommendationsFailed: "无法获取推荐结果。",
};

const zhTw: Dictionary = {
  loading: "載入中...",
  analyzing: "分析中...",
  mapSectionLabel: "地圖",
  mapPlaceholder: "請選擇地圖",
  backToInput: "← 返回選擇",
  metaBadge: (season, dataVersion) => `${season} 種子資料 · ${dataVersion}`,

  enemyTeam: "敵方隊伍",
  ourTeam: "我方隊伍",
  teamCount: (count, max) => `${count}/${max}`,
  uncategorized: "其他",

  mapPickerTitle: "選擇地圖",
  close: "關閉",
  mapCount: (count) => `${count}張`,

  inferredPositionPrefix: "缺少的位置 · ",
  legendCounter: "剋制",
  legendSynergy: "搭配",
  legendMap: "地圖",
  mustPickBadge: "必選",
  recommendationScore: (percentage) => `推薦指數 ${percentage}`,
  noDataPrefix: "尚無資料 · ",

  errorHeading: "發生暫時性錯誤",
  errorSubtext: "錯誤代碼 502 · BAD GATEWAY",
  retry: "重試",

  switchToLight: "切換為淺色模式",
  switchToDark: "切換為深色模式",

  apiInvalidInput: "請檢查輸入內容。",
  apiServerErrorStatus: (status) => `伺服器錯誤 (狀態碼 ${status})`,
  apiHeroesLoadFailed: "無法載入英雄清單。",
  apiMapsLoadFailed: "無法載入地圖清單。",
  apiRecommendationsFailed: "無法取得推薦結果。",
};

export const DICTIONARIES: Record<Locale, Dictionary> = { ko, en, ja, "zh-cn": zhCn, "zh-tw": zhTw };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

// 백엔드 role은 언어와 무관한 내부 식별자("tank"/"damage"/"support")라, 표시할 땐
// 로케일별로 번역한다.
export const ROLE_LABEL: Record<Locale, Record<Role, string>> = {
  ko: { tank: "돌격", damage: "공격", support: "지원" },
  en: { tank: "Tank", damage: "Damage", support: "Support" },
  ja: { tank: "タンク", damage: "ダメージ", support: "サポート" },
  "zh-cn": { tank: "坦克", damage: "输出", support: "支援" },
  "zh-tw": { tank: "坦克", damage: "輸出", support: "支援" },
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
  "zh-cn": {
    hybrid: "混合", escort: "护送", control: "占领",
    clash: "冲突", push: "推进", flashpoint: "热点",
  },
  "zh-tw": {
    hybrid: "混合", escort: "護送", control: "佔領",
    clash: "衝突", push: "推進", flashpoint: "熱點",
  },
};

export function modeLabel(locale: Locale, mode: string): string {
  return MODE_LABEL[locale][mode] ?? mode;
}

export const RICHNESS_LABEL: Record<Locale, Record<DataRichness, string>> = {
  ko: { rich: "데이터 풍부", growing: "데이터 보강 중" },
  en: { rich: "Rich data", growing: "Data growing" },
  ja: { rich: "データ充実", growing: "データ拡充中" },
  "zh-cn": { rich: "数据丰富", growing: "数据完善中" },
  "zh-tw": { rich: "資料豐富", growing: "資料完善中" },
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
  "zh-cn": {
    "개시자": "先锋", "투사": "斗士", "강건한 자": "重装战士",
    "전문가": "专家", "수색가": "侦察兵", "측면 공격가": "游走手", "명사수": "神射手",
    "전술가": "战术家", "의무관": "战地医疗兵", "생존왕": "生存专家",
  },
  "zh-tw": {
    "개시자": "先鋒", "투사": "鬥士", "강건한 자": "重裝戰士",
    "전문가": "專家", "수색가": "偵察兵", "측면 공격가": "游走手", "명사수": "神射手",
    "전술가": "戰術家", "의무관": "戰地醫療兵", "생존왕": "生存專家",
  },
};

export function archetypeCategoryLabel(locale: Locale, category: string): string {
  return ARCHETYPE_CATEGORY_LABEL[locale][category] ?? category;
}
