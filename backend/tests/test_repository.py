"""repository.py의 결측치 3단 상태 지원 조회 함수 + icon_url/archetype_category 포함 여부 유닛 테스트."""
from app.repository import (
    fetch_all_heroes,
    fetch_heroes_by_ids,
    fetch_heroes_by_role,
    fetch_reviewed_neutral_pairs,
)


def test_fetch_heroes_by_ids_returns_matching_rows(conn):
    rows = fetch_heroes_by_ids(conn, ["kiriko", "widowmaker"])
    names = {r["id"]: r["name"] for r in rows}
    assert names == {"kiriko": "키리코", "widowmaker": "위도우메이커"}


def test_fetch_heroes_by_ids_empty_list_returns_empty(conn):
    assert fetch_heroes_by_ids(conn, []) == []


def test_fetch_reviewed_neutral_pairs_counter_is_directional(conn):
    rows = fetch_reviewed_neutral_pairs(conn, ["lucio"], ["widowmaker"], "counter")
    assert len(rows) == 1
    assert rows[0]["hero_id"] == "lucio"
    assert rows[0]["other_hero_id"] == "widowmaker"

    # 카운터는 방향성이 있으므로 후보/상대를 뒤바꿔 조회하면 안 잡혀야 함
    reversed_rows = fetch_reviewed_neutral_pairs(conn, ["widowmaker"], ["lucio"], "counter")
    assert reversed_rows == []


def test_fetch_reviewed_neutral_pairs_synergy_matches_either_direction(conn):
    rows_forward = fetch_reviewed_neutral_pairs(conn, ["kiriko"], ["moira"], "synergy")
    assert len(rows_forward) == 1

    # 시너지는 대칭 관계이므로 candidate/other 인자를 뒤바꿔도 잡혀야 함
    rows_reversed_args = fetch_reviewed_neutral_pairs(conn, ["moira"], ["kiriko"], "synergy")
    assert len(rows_reversed_args) == 1


def test_fetch_all_heroes_includes_icon_and_archetype_category(conn):
    rows = fetch_all_heroes(conn)
    kiriko = next(r for r in rows if r["id"] == "kiriko")
    assert kiriko["icon_url"].startswith("https://d15f34w2p8l1cc.cloudfront.net/")
    assert kiriko["archetype_category"] == "의무관"


def test_fetch_heroes_by_role_includes_icon_and_archetype_category(conn):
    rows = fetch_heroes_by_role(conn, "support")
    kiriko = next(r for r in rows if r["id"] == "kiriko")
    assert kiriko["icon_url"].startswith("https://d15f34w2p8l1cc.cloudfront.net/")
    assert kiriko["archetype_category"] == "의무관"
