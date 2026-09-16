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
import math
from dataclasses import dataclass, field

from app.config import (
    MUST_PICK_PERCENTAGE_THRESHOLD,
    PERCENTAGE_AMPLITUDE,
    PERCENTAGE_BASELINE,
    PERCENTAGE_SCALE,
    WEIGHT_COUNTER,
    WEIGHT_COUNTERED_BY,
    WEIGHT_MAP_STRONG,
    WEIGHT_MAP_WEAK,
    WEIGHT_SYNERGY,
)

NEUTRAL_REASON = "일반적으로 무난한 영웅"

# 다국어 지원: data_gaps 문구와 "근거 없음" 기본 문구는 DB에 저장된 값이 아니라
# 이 파일에서 직접 조립하는 UI 텍스트라, reason처럼 컬럼을 선택하는 방식이 아니라
# 언어별 템플릿을 따로 둔다. 한국어만 "상대 겐지와의" 식 조사 처리가 필요해서
# _particle_wa_gwa가 한국어 케이스에서만 쓰인다.
_NEUTRAL_REASON_BY_LANG = {
    "ko": "일반적으로 무난한 영웅",
    "en": "A generally safe, well-rounded pick",
    "ja": "特に癖のない、無難なヒーロー",
}


def _counter_gap_message(lang: str, enemy_name: str) -> str:
    if lang == "en":
        return f"Counter matchup vs. {enemy_name} not yet reviewed"
    if lang == "ja":
        return f"敵の{enemy_name}とのカウンター関係は未検証"
    particle = _particle_wa_gwa(enemy_name)
    return f"상대 {enemy_name}{particle}의 카운터 관계 미검토"


def _synergy_gap_message(lang: str, ally_name: str) -> str:
    if lang == "en":
        return f"Synergy with {ally_name} not yet reviewed"
    if lang == "ja":
        return f"味方の{ally_name}とのシナジー関係は未検証"
    particle = _particle_wa_gwa(ally_name)
    return f"아군 {ally_name}{particle}의 시너지 관계 미검토"


def _particle_wa_gwa(name: str) -> str:
    """이름 끝 글자의 받침 유무에 따라 "와"/"과" 조사를 고른다.

    한글 음절(U+AC00~U+D7A3)은 (코드포인트 - 0xAC00) % 28 == 0이면 받침이
    없다(종성 없음) — 이때는 "와", 그 외(받침 있음)엔 "과"를 쓴다.
    한글 음절 범위 밖의 이름(빈 문자열, 영문 등)은 "와"로 폴백한다.
    """
    if not name:
        return "와"
    last_char = name[-1]
    code_point = ord(last_char)
    if 0xAC00 <= code_point <= 0xD7A3:
        return "와" if (code_point - 0xAC00) % 28 == 0 else "과"
    return "와"


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
    data_gaps: list[str] = field(default_factory=list)
    # "결측치 3단 상태": 미검토 상태인 카운터/시너지 관계만 여기 담긴다.
    # 검토완료-중립(reviewed_neutral_pairs에 등록됨)은 조용히 0점 처리되고
    # 여기 안 담긴다 — 스펙의 "결측치 3단 상태" 절 참고.

    @property
    def total_score(self) -> int:
        return self.counter_score + self.synergy_score + self.map_score

    @property
    def percentage(self) -> int:
        return round(
            PERCENTAGE_BASELINE + PERCENTAGE_AMPLITUDE * math.tanh(self.total_score / PERCENTAGE_SCALE)
        )

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
    countered_by_rows: list[dict] | None = None,
    id_to_name: dict[str, str] | None = None,
    lang: str = "ko",
) -> list[ScoredHero]:
    """candidates: [{id, name, role}, ...]
    counter_rows: [{hero_id, countered_hero_id, reason}, ...] (hero_id == candidate,
        즉 "후보가 상대를 카운터함")
    synergy_rows: [{hero_id, synergy_hero_id, reason}, ...] (양방향 매칭된 결과라고 가정)
    map_rows: [{hero_id, rating, reason}, ...]
    countered_by_rows: [{hero_id, countered_hero_id, reason}, ...] (hero_id == 상대,
        countered_hero_id == 후보, 즉 "상대가 후보를 카운터함" — counter_rows와 반대
        방향. 알려져 있으면 WEIGHT_COUNTERED_BY(음수)를 적용하고, 그 상대는
        미검토가 아니라 이미 검토된 것으로 취급한다.
    """
    # 중복 id가 섞여 들어와도(예: 요청 payload에 같은 영웅이 두 번 들어옴)
    # data_gaps에 같은 영웅에 대한 메시지가 중복 생성되지 않도록 순서를
    # 유지한 채 dedupe한다.
    enemy_ids = list(dict.fromkeys(enemy_ids or []))
    ally_ids = list(dict.fromkeys(ally_ids or []))
    reviewed_neutral_counter_pairs = reviewed_neutral_counter_pairs or []
    reviewed_neutral_synergy_pairs = reviewed_neutral_synergy_pairs or []
    countered_by_rows = countered_by_rows or []
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

    countered_by_hero: dict[str, list[dict]] = {}
    for row in countered_by_rows:
        countered_by_hero.setdefault(row["countered_hero_id"], []).append(row)

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

        countered_enemy_ids: set[str] = set()
        for row in counter_by_hero.get(cid, []):
            scored.counter_score += WEIGHT_COUNTER
            scored.reasons.append(row["reason"])
            countered_enemy_ids.add(row["countered_hero_id"])

        countered_by_enemy_ids: set[str] = set()
        for row in countered_by_hero.get(cid, []):
            scored.counter_score += WEIGHT_COUNTERED_BY
            scored.reasons.append(row["reason"])
            countered_by_enemy_ids.add(row["hero_id"])

        for enemy_id in enemy_ids:
            if enemy_id == cid:
                # 미러 픽 허용 규칙상 후보가 상대 팀에도 있을 수 있음 — 자기 자신과의
                # "카운터 관계"는 애초에 성립하지 않으므로 결측치로 취급하지 않는다.
                continue
            if enemy_id in countered_enemy_ids:
                continue
            if enemy_id in countered_by_enemy_ids:
                # 반대 방향(상대가 후보를 카운터함)으로 이미 검토된 관계 — 후보
                # 입장에서 "카운터함"은 아니지만 미검토도 아니므로 데이터 갭이 아님.
                continue
            if (cid, enemy_id) in neutral_counter_set:
                continue
            enemy_name = id_to_name.get(enemy_id, enemy_id)
            scored.data_gaps.append(_counter_gap_message(lang, enemy_name))

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
            scored.data_gaps.append(_synergy_gap_message(lang, ally_name))

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
            scored.reasons.append(_NEUTRAL_REASON_BY_LANG.get(lang, NEUTRAL_REASON))

        results.append(scored)

    # 총점 내림차순, 동점이면 영웅명으로 안정 정렬
    results.sort(key=lambda s: (-s.total_score, s.hero_name))
    return results
