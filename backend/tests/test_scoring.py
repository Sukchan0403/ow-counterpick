"""점수 계산 로직 유닛 테스트 (스펙의 "테스트 전략" > 백엔드 > 점수 계산 로직).

DB 없이 순수하게 scoring.score_candidates()만 검증한다.
"""
import math

from app.config import (
    PERCENTAGE_SCALE,
    ROLE_INFLUENCE_WEIGHT,
    WEIGHT_COUNTER,
    WEIGHT_COUNTERED_BY,
    WEIGHT_MAP_STRONG,
    WEIGHT_SYNERGY,
)
from app.scoring import NEUTRAL_REASON, ScoredHero, _particle_wa_gwa, aggregate_team_percentage, score_candidates


def make_candidates():
    return [
        {"id": "kiriko", "name": "키리코", "role": "support", "archetype": "정찰 지원"},
        {"id": "lucio", "name": "루시우", "role": "support", "archetype": "기동 지원"},
        {"id": "moira", "name": "모이라", "role": "support", "archetype": "근접 유지 지원"},
    ]


def test_counter_score_applies_only_to_matching_candidate():
    candidates = make_candidates()
    counter_rows = [
        {"hero_id": "kiriko", "countered_hero_id": "widowmaker", "reason": "스즈 무효화"}
    ]
    result = score_candidates(candidates, counter_rows, [], [])

    by_id = {s.hero_id: s for s in result}
    assert by_id["kiriko"].counter_score == WEIGHT_COUNTER
    assert by_id["kiriko"].reasons == ["스즈 무효화"]
    assert by_id["lucio"].counter_score == 0
    assert by_id["moira"].counter_score == 0


def test_synergy_matches_regardless_of_stored_direction():
    """synergy_relations는 한 방향으로만 저장되므로, 후보가 synergy_hero_id 쪽에
    저장된 경우도 잡아야 한다."""
    candidates = make_candidates()
    synergy_rows = [
        # tracer(아군) -> kiriko(후보) 방향으로 저장된 경우를 가정
        {"hero_id": "tracer", "synergy_hero_id": "kiriko", "reason": "순간이동으로 합류"}
    ]
    result = score_candidates(candidates, [], synergy_rows, [])

    by_id = {s.hero_id: s for s in result}
    assert by_id["kiriko"].synergy_score == 10
    assert by_id["kiriko"].reasons == ["순간이동으로 합류"]


def test_map_rating_strong_and_weak():
    candidates = make_candidates()
    map_rows = [
        {"hero_id": "moira", "rating": "강함", "reason": "실내 구간에서 유지력 좋음"},
        {"hero_id": "lucio", "rating": "약함", "reason": "개활지에서 취약"},
    ]
    result = score_candidates(candidates, [], [], map_rows)
    by_id = {s.hero_id: s for s in result}

    assert by_id["moira"].map_score == 15
    assert by_id["lucio"].map_score == -15
    assert by_id["kiriko"].map_score == 0  # 데이터 없음 = 중립


def test_no_data_falls_back_to_neutral_reason():
    candidates = make_candidates()
    result = score_candidates(candidates, [], [], [])
    for s in result:
        assert s.total_score == 0
        assert s.reasons == [NEUTRAL_REASON]


def test_total_score_sums_all_three_components_and_sorts_descending():
    candidates = make_candidates()
    counter_rows = [{"hero_id": "kiriko", "countered_hero_id": "ana", "reason": "수면 무효화"}]
    synergy_rows = [{"hero_id": "kiriko", "synergy_hero_id": "tracer", "reason": "합류"}]
    map_rows = [{"hero_id": "kiriko", "rating": "강함", "reason": "이 맵에서 강세"}]

    result = score_candidates(candidates, counter_rows, synergy_rows, map_rows)

    assert result[0].hero_id == "kiriko"
    expected_total = WEIGHT_COUNTER + WEIGHT_SYNERGY + WEIGHT_MAP_STRONG
    assert result[0].total_score == expected_total
    assert result[0].percentage == round(50 + 50 * math.tanh(expected_total / PERCENTAGE_SCALE))
    assert len(result[0].reasons) == 3
    assert result[0].is_must_pick is True  # percentage(94) >= MUST_PICK_PERCENTAGE_THRESHOLD(90)


def test_archetype_passes_through_and_notes_defaults_empty():
    candidates = make_candidates()
    result = score_candidates(candidates, [], [], [])
    by_id = {s.hero_id: s for s in result}
    assert by_id["kiriko"].archetype == "정찰 지원"
    assert by_id["kiriko"].notes == []
    assert by_id["kiriko"].is_must_pick is False  # percentage(50) < threshold(90)


def test_data_gaps_flags_unreviewed_enemy_counter_relation():
    candidates = make_candidates()
    result = score_candidates(
        candidates, [], [], [],
        enemy_ids=["widowmaker"],
        id_to_name={"widowmaker": "위도우메이커"},
    )
    by_id = {s.hero_id: s for s in result}
    assert by_id["kiriko"].data_gaps == ["상대 위도우메이커와의 카운터 관계 미검토"]


def test_data_gaps_silent_when_pair_is_reviewed_neutral():
    candidates = make_candidates()
    result = score_candidates(
        candidates, [], [], [],
        enemy_ids=["widowmaker"],
        reviewed_neutral_counter_pairs=[{"hero_id": "kiriko", "other_hero_id": "widowmaker"}],
        id_to_name={"widowmaker": "위도우메이커"},
    )
    by_id = {s.hero_id: s for s in result}
    assert by_id["kiriko"].data_gaps == []
    assert by_id["kiriko"].counter_score == 0


def test_data_gaps_skips_enemy_already_matched_by_actual_counter_row():
    candidates = make_candidates()
    counter_rows = [{"hero_id": "kiriko", "countered_hero_id": "widowmaker", "reason": "스즈 무효화"}]
    result = score_candidates(
        candidates, counter_rows, [], [],
        enemy_ids=["widowmaker"],
        id_to_name={"widowmaker": "위도우메이커"},
    )
    by_id = {s.hero_id: s for s in result}
    assert by_id["kiriko"].data_gaps == []


def test_countered_by_enemy_applies_negative_weight_and_reason():
    """상대가 후보를 카운터한다고 알려져 있으면(반대 방향), 후보의 counter_score에
    WEIGHT_COUNTERED_BY(음수)가 적용되고 그 근거가 reasons에 담겨야 한다."""
    candidates = make_candidates()
    countered_by_rows = [
        {"hero_id": "widowmaker", "countered_hero_id": "kiriko", "reason": "장거리 견제에 취약"}
    ]
    result = score_candidates(
        candidates, [], [], [],
        enemy_ids=["widowmaker"],
        countered_by_rows=countered_by_rows,
        id_to_name={"widowmaker": "위도우메이커"},
    )
    by_id = {s.hero_id: s for s in result}
    assert by_id["kiriko"].counter_score == WEIGHT_COUNTERED_BY
    assert by_id["kiriko"].reasons == ["장거리 견제에 취약"]


def test_countered_by_enemy_is_not_a_data_gap():
    """반대 방향으로라도 검토된 관계면 "미검토"가 아니다 — 후보가 그 상대를
    카운터하는지는 몰라도, 그 상대가 후보를 카운터한다는 건 이미 알고 있으므로."""
    candidates = make_candidates()
    countered_by_rows = [
        {"hero_id": "widowmaker", "countered_hero_id": "kiriko", "reason": "장거리 견제에 취약"}
    ]
    result = score_candidates(
        candidates, [], [], [],
        enemy_ids=["widowmaker"],
        countered_by_rows=countered_by_rows,
        id_to_name={"widowmaker": "위도우메이커"},
    )
    by_id = {s.hero_id: s for s in result}
    assert by_id["kiriko"].data_gaps == []
    # 이 관계를 모르는 다른 후보(모이라)는 여전히 미검토로 남아야 함
    assert by_id["moira"].data_gaps == ["상대 위도우메이커와의 카운터 관계 미검토"]


def test_counter_and_countered_by_can_offset_for_same_candidate():
    """후보가 어떤 상대는 카운터하고 다른 상대에게는 카운터당하면, counter_score는
    두 값의 순합이어야 한다(서로 상쇄 가능)."""
    candidates = make_candidates()
    counter_rows = [
        {"hero_id": "kiriko", "countered_hero_id": "widowmaker", "reason": "스즈 무효화"}
    ]
    countered_by_rows = [
        {"hero_id": "genji", "countered_hero_id": "kiriko", "reason": "근접 다이브에 취약"}
    ]
    result = score_candidates(
        candidates, counter_rows, [], [],
        enemy_ids=["widowmaker", "genji"],
        countered_by_rows=countered_by_rows,
        id_to_name={"widowmaker": "위도우메이커", "genji": "겐지"},
    )
    by_id = {s.hero_id: s for s in result}
    assert by_id["kiriko"].counter_score == WEIGHT_COUNTER + WEIGHT_COUNTERED_BY
    assert by_id["kiriko"].data_gaps == []


def test_data_gaps_flags_unreviewed_ally_synergy_relation():
    candidates = make_candidates()
    result = score_candidates(
        candidates, [], [], [],
        ally_ids=["tracer"],
        id_to_name={"tracer": "트레이서"},
    )
    by_id = {s.hero_id: s for s in result}
    assert by_id["kiriko"].data_gaps == ["아군 트레이서와의 시너지 관계 미검토"]


def test_data_gaps_synergy_silent_when_reviewed_neutral_either_direction():
    candidates = make_candidates()
    result = score_candidates(
        candidates, [], [], [],
        ally_ids=["tracer"],
        reviewed_neutral_synergy_pairs=[{"hero_id": "tracer", "other_hero_id": "kiriko"}],
        id_to_name={"tracer": "트레이서"},
    )
    by_id = {s.hero_id: s for s in result}
    assert by_id["kiriko"].data_gaps == []


def test_data_gaps_empty_by_default_when_no_enemy_or_ally_ids_given():
    candidates = make_candidates()
    result = score_candidates(candidates, [], [], [])
    for s in result:
        assert s.data_gaps == []


def test_data_gaps_deduplicates_repeated_enemy_and_ally_ids():
    """요청 payload에 같은 영웅 id가 중복으로 들어와도(예: 프론트 버그로
    enemy_heroes에 같은 영웅이 두 번) data_gaps 메시지가 중복 생성되면 안 된다."""
    candidates = make_candidates()
    result = score_candidates(
        candidates, [], [], [],
        enemy_ids=["widowmaker", "widowmaker"],
        ally_ids=["tracer", "tracer", "tracer"],
        id_to_name={"widowmaker": "위도우메이커", "tracer": "트레이서"},
    )
    by_id = {s.hero_id: s for s in result}
    assert by_id["kiriko"].data_gaps == [
        "상대 위도우메이커와의 카운터 관계 미검토",
        "아군 트레이서와의 시너지 관계 미검토",
    ]


# --- 조사(와/과) 문법 헬퍼 ---


def test_particle_wa_for_vowel_ending_hangul_name():
    # "위도우메이커"는 받침 없는 "커"로 끝나므로 "와"
    assert _particle_wa_gwa("위도우메이커") == "와"
    assert _particle_wa_gwa("트레이서") == "와"


def test_particle_gwa_for_consonant_ending_hangul_name():
    # "윈스턴"/"소전"은 받침 있는 글자로 끝나므로 "과"
    assert _particle_wa_gwa("윈스턴") == "과"
    assert _particle_wa_gwa("소전") == "과"


def test_particle_falls_back_to_wa_for_non_hangul_or_empty_name():
    assert _particle_wa_gwa("") == "와"
    assert _particle_wa_gwa("Tracer") == "와"


def test_data_gaps_message_uses_correct_particle_for_consonant_ending_name():
    """상대/아군 영웅 이름이 받침 있는 글자로 끝나면(예: "윈스턴") data_gaps
    문구에 "과"가 쓰여야 한다 ("윈스턴와의"가 아니라 "윈스턴과의")."""
    candidates = make_candidates()
    result = score_candidates(
        candidates, [], [], [],
        enemy_ids=["winston"],
        ally_ids=["sojourn"],
        id_to_name={"winston": "윈스턴", "sojourn": "소전"},
    )
    by_id = {s.hero_id: s for s in result}
    assert by_id["kiriko"].data_gaps == [
        "상대 윈스턴과의 카운터 관계 미검토",
        "아군 소전과의 시너지 관계 미검토",
    ]


# --- 하드카운터 가중치 불변식 (config.py 주석 참고) ---


def test_weight_counter_exceeds_max_synergy_plus_map_strong_invariant():
    """WEIGHT_COUNTER 1건이 다른 모든 보너스의 최댓값 합(시너지 최대 4명 ×
    WEIGHT_SYNERGY + WEIGHT_MAP_STRONG)보다 항상 커야 한다는 불변식을 실제
    설정값으로 직접 검증한다 — 이 상수들이 나중에 바뀌어도 불변식이 깨지면
    이 테스트가 바로 실패해야 한다."""
    assert WEIGHT_COUNTER > 4 * WEIGHT_SYNERGY + WEIGHT_MAP_STRONG


def test_single_counter_outranks_max_synergy_and_strong_map_candidate():
    """후보 A는 카운터 1건만 있고, 후보 B는 시너지 4건(최대) + 맵 "강함"까지
    다 갖췄어도, 하드카운터 가중치 불변식 덕에 A가 항상 B보다 위에 와야 한다."""
    candidates = [
        {"id": "kiriko", "name": "키리코", "role": "support", "archetype": "정찰 지원"},
        {"id": "lucio", "name": "루시우", "role": "support", "archetype": "기동 지원"},
        {"id": "moira", "name": "모이라", "role": "support", "archetype": "근접 유지 지원"},
    ]
    # 후보 A(kiriko): 카운터 1건만
    counter_rows = [
        {"hero_id": "kiriko", "countered_hero_id": "widowmaker", "reason": "스즈 무효화"}
    ]
    # 후보 B(lucio): 아군 4명 전부와 시너지
    synergy_rows = [
        {"hero_id": "lucio", "synergy_hero_id": "tracer", "reason": "합류1"},
        {"hero_id": "lucio", "synergy_hero_id": "genji", "reason": "합류2"},
        {"hero_id": "lucio", "synergy_hero_id": "ana", "reason": "합류3"},
        {"hero_id": "lucio", "synergy_hero_id": "baptiste", "reason": "합류4"},
    ]
    # 후보 B(lucio): 맵 평가도 "강함"
    map_rows = [
        {"hero_id": "lucio", "rating": "강함", "reason": "이 맵에서 강세"},
    ]

    result = score_candidates(
        candidates,
        counter_rows,
        synergy_rows,
        map_rows,
        enemy_ids=["widowmaker"],
        ally_ids=["tracer", "genji", "ana", "baptiste"],
    )

    by_id = {s.hero_id: s for s in result}
    assert by_id["kiriko"].total_score == WEIGHT_COUNTER
    assert by_id["lucio"].total_score == 4 * WEIGHT_SYNERGY + WEIGHT_MAP_STRONG
    assert by_id["kiriko"].total_score > by_id["lucio"].total_score
    assert result[0].hero_id == "kiriko"


def test_icon_url_and_archetype_category_default_to_empty_when_absent():
    candidates = make_candidates()  # icon_url/archetype_category 키 없음
    result = score_candidates(candidates, [], [], [])
    by_id = {s.hero_id: s for s in result}
    assert by_id["kiriko"].icon_url == ""
    assert by_id["kiriko"].archetype_category == ""


def test_icon_url_and_archetype_category_pass_through_when_present():
    candidates = [
        {
            "id": "kiriko",
            "name": "키리코",
            "role": "support",
            "archetype": "정찰 지원",
            "icon_url": "https://example.com/kiriko.png",
            "archetype_category": "의무관",
        },
    ]
    result = score_candidates(candidates, [], [], [])
    assert result[0].icon_url == "https://example.com/kiriko.png"
    assert result[0].archetype_category == "의무관"


def test_aggregate_team_percentage_returns_the_shared_value_when_all_equal():
    # 다섯 명 percentage가 전부 같으면, 가중치가 뭐든 결과는 그 값과 같아야 한다.
    evaluations = [
        ScoredHero(hero_id="t", hero_name="T", role="tank", counter_score=0),
        ScoredHero(hero_id="d1", hero_name="D1", role="damage", counter_score=0),
        ScoredHero(hero_id="d2", hero_name="D2", role="damage", counter_score=0),
        ScoredHero(hero_id="s1", hero_name="S1", role="support", counter_score=0),
        ScoredHero(hero_id="s2", hero_name="S2", role="support", counter_score=0),
    ]
    assert all(e.percentage == 50 for e in evaluations)
    assert aggregate_team_percentage(evaluations) == 50


def test_aggregate_team_percentage_weighs_tank_more_than_support():
    # 탱커 한 명만 카운터당하고(총점 -60) 나머지 4명은 중립(총점 0)인 두 케이스를
    # 비교 — 카운터당한 사람이 탱커일 때가 힐러일 때보다 종합 점수가 더 낮아야
    # 한다(config.ROLE_INFLUENCE_WEIGHT: 탱커 > 딜러 > 힐러).
    tank_hurt = [
        ScoredHero(hero_id="tank", hero_name="T", role="tank", counter_score=-60),
        ScoredHero(hero_id="d1", hero_name="D1", role="damage", counter_score=0),
        ScoredHero(hero_id="d2", hero_name="D2", role="damage", counter_score=0),
        ScoredHero(hero_id="s1", hero_name="S1", role="support", counter_score=0),
        ScoredHero(hero_id="s2", hero_name="S2", role="support", counter_score=0),
    ]
    support_hurt = [
        ScoredHero(hero_id="tank", hero_name="T", role="tank", counter_score=0),
        ScoredHero(hero_id="d1", hero_name="D1", role="damage", counter_score=0),
        ScoredHero(hero_id="d2", hero_name="D2", role="damage", counter_score=0),
        ScoredHero(hero_id="s1", hero_name="S1", role="support", counter_score=-60),
        ScoredHero(hero_id="s2", hero_name="S2", role="support", counter_score=0),
    ]

    assert aggregate_team_percentage(tank_hurt) < aggregate_team_percentage(support_hurt)

    # 정확한 값도 검증: 가중 평균 공식 그대로.
    hurt_pct = round(50 + 50 * math.tanh(-60 / PERCENTAGE_SCALE))
    tank_w, damage_w, support_w = (
        ROLE_INFLUENCE_WEIGHT["tank"], ROLE_INFLUENCE_WEIGHT["damage"], ROLE_INFLUENCE_WEIGHT["support"],
    )
    expected_tank_hurt = round(
        (tank_w * hurt_pct + damage_w * 50 * 2 + support_w * 50 * 2)
        / (tank_w + damage_w * 2 + support_w * 2)
    )
    assert aggregate_team_percentage(tank_hurt) == expected_tank_hurt
