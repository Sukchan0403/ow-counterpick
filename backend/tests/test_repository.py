"""repository.py의 heroes 조회 함수가 icon_url/archetype_category를 포함하는지 검증."""
from app.repository import fetch_all_heroes, fetch_heroes_by_role


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
