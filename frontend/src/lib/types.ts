// 백엔드(ow-backend/app/models.py)의 Pydantic 모델과 1:1로 맞춘 타입.

export type Role = "tank" | "damage" | "support";
export type DataRichness = "rich" | "growing";

export interface Hero {
  id: string;
  name: string;
  role: Role;
  archetype: string;
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
  total_score: number;
  percentage: number;
  score_breakdown: ScoreBreakdown;
  reasons: string[];
  is_must_pick: boolean;
  notes: string[];
  data_gaps: string[];
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
  tank: "탱커",
  damage: "딜러",
  support: "힐러",
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
