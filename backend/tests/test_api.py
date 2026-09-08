"""POST /api/recommendations, GET /api/heroes, GET /api/maps 라우트 테스트
(스펙의 "테스트 전략" > 백엔드 > 라우트 테스트).
"""


def test_get_heroes(client):
    res = client.get("/api/heroes")
    assert res.status_code == 200
    heroes = {h["id"]: h for h in res.json()}
    assert "kiriko" in heroes and "genji" in heroes
    assert heroes["kiriko"]["archetype"] == "정찰 지원"
    assert heroes["kiriko"]["archetype_category"] == "의무관"
    assert heroes["kiriko"]["icon_url"].startswith("https://d15f34w2p8l1cc.cloudfront.net/")


def test_get_maps(client):
    """MapPicker.dc.html의 '데이터 풍부'/'데이터 보강 중' 배지용 data_richness 필드.
    eichenwalde는 rating 1건(growing), kings_row는 3건(rich, threshold=3)."""
    res = client.get("/api/maps")
    assert res.status_code == 200
    maps = {m["id"]: m for m in res.json()}
    assert maps["eichenwalde"]["data_richness"] == "growing"
    assert maps["kings_row"]["data_richness"] == "rich"


def test_get_meta(client):
    """Main.dc.html 헤더의 '시즌 4 시드 데이터 · v0.3' 배지용 신규 엔드포인트."""
    res = client.get("/api/meta")
    assert res.status_code == 200
    body = res.json()
    assert body["season"] and body["data_version"]


def test_recommendations_normal_case(client):
    """상대 위도우메이커 + 아군 겐지 + 아이헨발데 맵 -> support 빈 포지션 추천."""
    res = client.post(
        "/api/recommendations",
        json={
            "enemy_heroes": ["widowmaker"],
            "our_heroes": ["genji"],
            "empty_position": "support",
            "map_id": "eichenwalde",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["notice"] is None

    top = body["recommendations"][0]
    # 키리코: 위도우메이커 카운터(15) + 겐지랑 시너지 없음(0) + 맵 데이터 없음(0) = 15
    # 모이라: 카운터 없음(0) + 시너지 없음(0) + 맵 강함(15) = 15
    # 둘 다 15점 동점 -> 이름 알파벳/가나다 순 정렬(모이라가 키리코보다 앞? 정렬은 문자열 비교)
    scores = {r["hero_id"]: r["total_score"] for r in body["recommendations"]}
    assert scores["kiriko"] == 15
    assert scores["moira"] == 15
    assert scores["lucio"] == 10  # 겐지와 시너지만


def test_recommendations_excludes_already_picked_heroes(client):
    res = client.post(
        "/api/recommendations",
        json={
            "enemy_heroes": [],
            "our_heroes": ["kiriko"],  # 이미 뽑힌 support는 후보에서 빠져야 함
            "empty_position": "support",
            "map_id": "eichenwalde",
        },
    )
    assert res.status_code == 200
    ids = {r["hero_id"] for r in res.json()["recommendations"]}
    assert "kiriko" not in ids


def test_recommendations_no_picks_returns_notice_and_map_only_score(client):
    """스펙: 상대/우리 팀 픽을 하나도 입력하지 않으면 -> 맵 점수만 반영, notice 표시."""
    res = client.post(
        "/api/recommendations",
        json={
            "enemy_heroes": [],
            "our_heroes": [],
            "empty_position": "support",
            "map_id": "eichenwalde",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["notice"] is not None

    top_scores = {r["hero_id"]: r["score_breakdown"] for r in body["recommendations"]}
    assert top_scores["moira"]["counter"] == 0
    assert top_scores["moira"]["synergy"] == 0
    assert top_scores["moira"]["map"] == 15


def test_recommendations_allows_mirror_pick_from_enemy_team(client):
    """오버워치 경쟁전 규칙상 '영웅 1인 1팀' 제한은 팀 내부에서만 적용된다 —
    상대 팀이 이미 픽한 영웅도 우리 팀 후보에는 남아있어야 한다(미러 픽 허용)."""
    res = client.post(
        "/api/recommendations",
        json={
            "enemy_heroes": ["kiriko"],
            "our_heroes": [],
            "empty_position": "support",
            "map_id": "eichenwalde",
        },
    )
    assert res.status_code == 200
    ids = {r["hero_id"] for r in res.json()["recommendations"]}
    assert "kiriko" in ids


def test_recommendations_unknown_hero_returns_400(client):
    res = client.post(
        "/api/recommendations",
        json={
            "enemy_heroes": ["존재하지않는영웅"],
            "our_heroes": [],
            "empty_position": "support",
            "map_id": "eichenwalde",
        },
    )
    assert res.status_code == 400


def test_recommendations_unknown_map_returns_400(client):
    res = client.post(
        "/api/recommendations",
        json={
            "enemy_heroes": [],
            "our_heroes": [],
            "empty_position": "support",
            "map_id": "존재하지않는맵",
        },
    )
    assert res.status_code == 400


def test_recommendations_missing_required_field_returns_422(client):
    """empty_position/map_id 미입력 -> pydantic 검증 실패(422). 프론트에서
    막아야 하는 케이스지만 백엔드도 클라이언트를 신뢰하지 않고 막아야 한다."""
    res = client.post("/api/recommendations", json={"enemy_heroes": [], "our_heroes": []})
    assert res.status_code == 422


def test_neutral_hero_with_no_matching_data_gets_neutral_reason(client):
    res = client.post(
        "/api/recommendations",
        json={
            "enemy_heroes": [],
            "our_heroes": [],
            "empty_position": "support",
            "map_id": "eichenwalde",
        },
    )
    body = res.json()
    ana_row = next(r for r in body["recommendations"] if r["hero_id"] == "ana")
    assert ana_row["reasons"] == ["일반적으로 무난한 영웅"]
    assert ana_row["total_score"] == 0


def test_recommendation_includes_archetype_and_empty_notes(client):
    """목업 필드 완결성 점검: Result.dc.html의 '힐러 · 정찰 지원' 서브타이틀은
    archetype 필드로, notes는 아직 큐레이션된 데이터가 없어 항상 빈 리스트."""
    res = client.post(
        "/api/recommendations",
        json={
            "enemy_heroes": [],
            "our_heroes": [],
            "empty_position": "support",
            "map_id": "eichenwalde",
        },
    )
    body = res.json()
    kiriko_row = next(r for r in body["recommendations"] if r["hero_id"] == "kiriko")
    assert kiriko_row["archetype"] == "정찰 지원"
    assert kiriko_row["notes"] == []


def test_is_must_pick_when_percentage_reaches_threshold(client):
    """카운터+시너지+맵 강함이 한 후보에 다 몰려서 percentage>=90이 되면
    Result.dc.html의 '필수픽' 배지에 해당하는 is_must_pick이 true여야 한다."""
    res = client.post(
        "/api/recommendations",
        json={
            "enemy_heroes": ["genji"],
            "our_heroes": ["ana"],
            "empty_position": "tank",
            "map_id": "kings_row",
        },
    )
    assert res.status_code == 200
    body = res.json()
    reinhardt_row = next(r for r in body["recommendations"] if r["hero_id"] == "reinhardt")
    assert reinhardt_row["percentage"] == 90
    assert reinhardt_row["is_must_pick"] is True

    # 다른 후보(합산 점수가 낮은 쪽)는 must-pick이 아니어야 함
    others = [r for r in body["recommendations"] if r["hero_id"] != "reinhardt"]
    assert all(not o["is_must_pick"] for o in others)


def test_recommendation_includes_icon_url_and_archetype_category(client):
    res = client.post(
        "/api/recommendations",
        json={
            "enemy_heroes": [],
            "our_heroes": [],
            "empty_position": "support",
            "map_id": "eichenwalde",
        },
    )
    body = res.json()
    kiriko_row = next(r for r in body["recommendations"] if r["hero_id"] == "kiriko")
    assert kiriko_row["icon_url"].startswith("https://d15f34w2p8l1cc.cloudfront.net/")
    assert kiriko_row["archetype_category"] == "의무관"
