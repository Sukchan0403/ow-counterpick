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
    data_gaps: list[str] = field(default_factory=list)
    # "결측치 3단 상태": 미검토 상태인 카운터/시너지 관계만 여기 담긴다.
    # 검토완료-중립(reviewed_neutral_pairs에 등록됨)은 조용히 0점 처리되고
    # 여기 안 담긴다 — 스펙의 "결측치 3단 상태" 절 참고.

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
    *,
    enemy_ids: list[str] | None = None,
    ally_ids: list[str] | None = None,
    reviewed_neutral_counter_pairs: list[dict] | None = None,
    reviewed_neutral_synergy_pairs: list[dict] | None = None,
    id_to_name: dict[str, str] | None = None,
) -> list[ScoredHero]:
    """candidates: [{id, name, role}, ...]
    counter_rows: [{hero_id, countered_hero_id, reason}, ...] (hero_id == candidate)
    synergy_rows: [{hero_id, synergy_hero_id, reason}, ...] (양방향 매칭된 결과라고 가정)
    map_rows: [{hero_id, rating, reason}, ...]
    """
    enemy_ids = enemy_ids or []
    ally_ids = ally_ids or []
    reviewed_neutral_counter_pairs = reviewed_neutral_counter_pairs or []
    reviewed_neutral_synergy_pairs = reviewed_neutral_synergy_pairs or []
    id_to_name = id_to_name or {}

    neutral_counter_set = {
        (row["hero_id"], row["other_hero_id"]) for row in reviewed_neutral_counter_pairs
    }
    neutral_synergy_set: set[tuple[str, str]] = set()
    for row in reviewed_neutral_synergy_pairs:
        neutral_synergy_set.add((row["hero_id"], row["other_hero_id"]))
        neutral_synergy_set.add((row["other_hero_id"], row["hero_id"]))

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
        )

        for row in counter_by_hero.get(cid, []):
            scored.counter_score += WEIGHT_COUNTER
            scored.reasons.append(row["reason"])

        countered_enemy_ids = {row["countered_hero_id"] for row in counter_by_hero.get(cid, [])}
        for enemy_id in enemy_ids:
            if enemy_id in countered_enemy_ids:
                continue
            if (cid, enemy_id) in neutral_counter_set:
                continue
            enemy_name = id_to_name.get(enemy_id, enemy_id)
            scored.data_gaps.append(f"상대 {enemy_name}와의 카운터 관계 미검토")

        # 시너지는 같은 관계 row가 중복으로 안 잡히도록 이미 처리한 상대 id를 추적
        seen_partners: set[str] = set()
        for row in synergy_by_hero.get(cid, []):
            partner_id = row["synergy_hero_id"] if row["hero_id"] == cid else row["hero_id"]
            if partner_id in seen_partners:
                continue
            seen_partners.add(partner_id)
            scored.synergy_score += WEIGHT_SYNERGY
            scored.reasons.append(row["reason"])

        for ally_id in ally_ids:
            if ally_id in seen_partners:
                continue
            if (cid, ally_id) in neutral_synergy_set:
                continue
            ally_name = id_to_name.get(ally_id, ally_id)
            scored.data_gaps.append(f"아군 {ally_name}와의 시너지 관계 미검토")

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
