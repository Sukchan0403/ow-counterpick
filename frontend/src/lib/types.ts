// 백엔드(ow-backend/app/models.py)의 Pydantic 모델과 1:1로 맞춘 타입.

export type Role = "tank" | "damage" | "support";
export type DataRichness = "rich" | "growing";

export interface Hero {
  id: string;
  name: string;
  role: Role;
  archetype: string;
  icon_url: string;
  archetype_category: string;
}

export interface MapInfo {
  id: string;
  name: string;
  mode: string; // 백엔드 원본 값은 영문 enum("hybrid"/"escort"/"control") — 표시할 땐 MODE_LABEL로 변환
  data_richness: DataRichness;
}

export interface RecommendationRequest {
  enemy_heroes: string[];
  our_heroes: string[];
  empty_position: Role;
  map_id: string;
}

export interface ScoreBreakdown {
  counter: number;
  synergy: number;
  map: number;
}

export interface HeroRecommendation {
  hero_id: string;
  hero_name: string;
  role: Role;
  archetype: string;
  icon_url: string;
  archetype_category: string;
  total_score: number;
  percentage: number;
  score_breakdown: ScoreBreakdown;
  reasons: string[];
  is_must_pick: boolean;
  notes: string[];
}

export interface RecommendationResponse {
  recommendations: HeroRecommendation[];
  notice: string | null;
}

// Main.dc.html 헤더의 "시즌 4 시드 데이터 · v0.3" 배지용.
export interface MetaInfo {
  season: string;
  data_version: string;
}

export const ROLE_LABEL: Record<Role, string> = {
  tank: "돌격",
  damage: "공격",
  support: "지원",
};

// 블리자드 공식 아키타입 카테고리 (역할별 유효값, 표시 순서 고정).
// 스펙의 "UI 리디자인" 섹션 표 참고.
// 주의: 이 목록은 seed-data/seed_db.py의 ALLOWED_ARCHETYPE_CATEGORIES와 같은
// 값을 유지해야 한다 (공유 소스가 없어 양쪽 다 수동으로 갱신해야 함) — 한쪽만
// 바뀌면 seed_db.py의 무결성 체크는 통과해도 여기서 그 카테고리를 몰라 헤어로
// 피커가 조용히 "기타" 그룹으로 빠뜨린다.
export const ARCHETYPE_CATEGORY_ORDER: Record<Role, string[]> = {
  tank: ["개시자", "투사", "강건한 자"],
  damage: ["전문가", "수색가", "측면 공격가", "명사수"],
  support: ["전술가", "의무관", "생존왕"],
};

// 백엔드 maps.mode는 영문 enum으로 저장돼 있음 (seed-data/maps.json 참고) — 화면엔 한글로 표시.
export const MODE_LABEL: Record<string, string> = {
  hybrid: "혼합",
  escort: "호위",
  control: "점령",
};

export const RICHNESS_LABEL: Record<DataRichness, string> = {
  rich: "데이터 풍부",
  growing: "데이터 보강 중",
};

export function modeLabel(mode: string): string {
  return MODE_LABEL[mode] ?? mode;
}
