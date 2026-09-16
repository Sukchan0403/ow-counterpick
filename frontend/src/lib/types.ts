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
  image_url: string;
  data_richness: DataRichness;
}

export interface RecommendationRequest {
  enemy_heroes: string[];
  our_heroes: string[];
  // 생략하면 백엔드가 our_heroes 4명의 역할 구성으로 빈 포지션을 자동 판단한다.
  empty_position?: Role;
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
  data_gaps: string[];
}

export interface RecommendationResponse {
  recommendations: HeroRecommendation[];
  // 실제로 추천에 쓰인 포지션 — 요청에서 생략됐으면 자동 판단된 값.
  empty_position: Role;
  notice: string | null;
}

// Main.dc.html 헤더의 "시즌 4 시드 데이터 · v0.3" 배지용.
export interface MetaInfo {
  season: string;
  data_version: string;
}

// ROLE_LABEL/MODE_LABEL/RICHNESS_LABEL/modeLabel은 표시 문구라 lib/i18n.ts로
// 옮겨서 로케일별로 번역한다 — 이 파일엔 언어와 무관한 데이터 shape과 구조적
// 상수(ARCHETYPE_CATEGORY_ORDER)만 남긴다.

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
