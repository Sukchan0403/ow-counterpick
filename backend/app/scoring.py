"""
점수 계산 로직 (스펙의 "점수 계산 로직" 섹션 그대로 구현).

DB에 의존하지 않는 순수 함수로 만들어서, repository에서 가져온 row들만
넘기면 계산 결과를 검증할 수 있다 (tests/test_scoring.py 참고).

후보 영웅 X에 대해:
- 카운터 점수 = X가 카운터하는 상대 팀 영웅 수 × WEIGHT_COUNTER
- 시너지 점수 = X와 시너지가 좋은 우리 팀 영웅 수 × WEIGHT_SYNERGY
- 맵 점수 = 해당 맵에서 X의 평가(강함/보통/약함)에 따른 가중치
- 총점 = 세 점수의 합

데이터가 없는 조합(카운터/시너지/맵 평가 미등록)은 해당 항목 점수를
0(중립)으로 처리한다. 근거가 하나도 없으면 "일반적으로 무난한 영웅" 문구를 쓴다.
"""
from dataclasses import dataclass, field

from app.config import (
    MUST_PICK_PERCENTAGE_THRESHOLD,
    PERCENTAGE_BASELINE,
    WEIGHT_COUNTER,
    WEIGHT_MAP_STRONG,
    WEIGHT_MAP_WEAK,
    WEIGHT_SYNERGY,
)

NEUTRAL_REASON = "일반적으로 무난한 영웅"


@dataclass
class ScoredHero:
    hero_id: str
    hero_name: str
    role: str
    archetype: str = ""
    counter_score: int = 0
    synergy_score: int = 0
    map_score: int = 0
    reasons: list[str] = field(default_factory=list)
    # 지금 시드 데이터엔 이 콘텐츠가 큐레이션돼 있지 않아 항상 빈 리스트 —
    # 목업 필드 완결성 점검 후 스키마만 먼저 맞춰둔 자리 (models.HeroRecommendation.notes 참고)
    notes: list[str] = field(default_factory=list)
    icon_url: str = ""
    archetype_category: str = ""

    @property
    def total_score(self) -> int:
        return self.counter_score + self.synergy_score + self.map_score

    @property
    def percentage(self) -> int:
        pct = PERCENTAGE_BASELINE + self.total_score
        return max(0, min(100, pct))

    @property
    def is_must_pick(self) -> bool:
        return self.percentage >= MUST_PICK_PERCENTAGE_THRESHOLD


def score_candidates(
    candidates: list[dict],
    counter_rows: list[dict],
    synergy_rows: list[dict],
    map_rows: list[dict],
) -> list[ScoredHero]:
    """candidates: [{id, name, role}, ...]
    counter_rows: [{hero_id, countered_hero_id, reason}, ...] (hero_id == candidate)
    synergy_rows: [{hero_id, synergy_hero_id, reason}, ...] (양방향 매칭된 결과라고 가정)
    map_rows: [{hero_id, rating, reason}, ...]
    """
    counter_by_hero: dict[str, list[dict]] = {}
    for row in counter_rows:
        counter_by_hero.setdefault(row["hero_id"], []).append(row)

    synergy_by_hero: dict[str, list[dict]] = {}
    for row in synergy_rows:
        # synergy_rows는 hero_id/synergy_hero_id 어느 쪽이 후보인지 모르니 둘 다 확인
        if row["hero_id"] not in synergy_by_hero:
            synergy_by_hero[row["hero_id"]] = []
        synergy_by_hero[row["hero_id"]].append(row)
        if row["synergy_hero_id"] not in synergy_by_hero:
            synergy_by_hero[row["synergy_hero_id"]] = []
        synergy_by_hero[row["synergy_hero_id"]].append(row)

    map_by_hero: dict[str, dict] = {row["hero_id"]: row for row in map_rows}

    results: list[ScoredHero] = []
    for candidate in candidates:
        cid = candidate["id"]
        scored = ScoredHero(
            hero_id=cid,
            hero_name=candidate["name"],
            role=candidate["role"],
            archetype=candidate.get("archetype", ""),
            icon_url=candidate.get("icon_url", ""),
            archetype_category=candidate.get("archetype_category", ""),
        )

        for row in counter_by_hero.get(cid, []):
            scored.counter_score += WEIGHT_COUNTER
            scored.reasons.append(row["reason"])

        # 시너지는 같은 관계 row가 중복으로 안 잡히도록 이미 처리한 상대 id를 추적
        seen_partners: set[str] = set()
        for row in synergy_by_hero.get(cid, []):
            partner_id = row["synergy_hero_id"] if row["hero_id"] == cid else row["hero_id"]
            if partner_id in seen_partners:
                continue
            seen_partners.add(partner_id)
            scored.synergy_score += WEIGHT_SYNERGY
            scored.reasons.append(row["reason"])

        map_row = map_by_hero.get(cid)
        if map_row is not None:
            if map_row["rating"] == "강함":
                scored.map_score = WEIGHT_MAP_STRONG
                scored.reasons.append(map_row["reason"])
            elif map_row["rating"] == "약함":
                scored.map_score = WEIGHT_MAP_WEAK
                scored.reasons.append(map_row["reason"])
            # "보통"이면 map_score 0, 근거도 추가 안 함 (스펙: 근거에 표시하지 않음)

        if not scored.reasons:
            scored.reasons.append(NEUTRAL_REASON)

        results.append(scored)

    # 총점 내림차순, 동점이면 영웅명으로 안정 정렬
    results.sort(key=lambda s: (-s.total_score, s.hero_name))
    return results
