"""점수 계산 로직 유닛 테스트 (스펙의 "테스트 전략" > 백엔드 > 점수 계산 로직).

DB 없이 순수하게 scoring.score_candidates()만 검증한다.
"""
from app.scoring import NEUTRAL_REASON, score_candidates


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
    assert by_id["kiriko"].counter_score == 15
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
    assert result[0].total_score == 15 + 10 + 15
    assert result[0].percentage == 90  # 50 + 40
    assert len(result[0].reasons) == 3
    assert result[0].is_must_pick is True  # percentage(90) >= MUST_PICK_PERCENTAGE_THRESHOLD(90)


def test_archetype_passes_through_and_notes_defaults_empty():
    candidates = make_candidates()
    result = score_candidates(candidates, [], [], [])
    by_id = {s.hero_id: s for s in result}
    assert by_id["kiriko"].archetype == "정찰 지원"
    assert by_id["kiriko"].notes == []
    assert by_id["kiriko"].is_must_pick is False  # percentage(50) < threshold(90)


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
