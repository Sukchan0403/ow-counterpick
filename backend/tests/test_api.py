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
    assert maps["eichenwalde"]["image_url"].startswith("https://overfast-api.tekrop.fr/")


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
    # 키리코: 위도우메이커 카운터(60, WEIGHT_COUNTER 상향 후) + 겐지랑 시너지 없음(0)
    #         + 맵 데이터 없음(0) = 60
    # 모이라: 카운터 없음(0) + 시너지 없음(0) + 맵 강함(15) = 15
    # 루시우: 카운터 없음(0) + 겐지와 시너지(10) + 맵 데이터 없음(0) = 10
    scores = {r["hero_id"]: r["total_score"] for r in body["recommendations"]}
    assert scores["kiriko"] == 60
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
    """map_id 미입력 -> pydantic 검증 실패(422). empty_position은 이제 선택 필드라
    빠져도 422를 유발하지 않는다 — 프론트에서 막아야 하는 케이스지만 백엔드도
    클라이언트를 신뢰하지 않고 막아야 한다."""
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
    """목업 필드 완결성 점검: Result.dc.html의 '지원 · 정찰 지원' 서브타이틀은
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
    assert reinhardt_row["is_must_pick"] is True
    # tanh 포화 곡선 — 카운터+시너지+맵강함이 겹친 강한 조합이지만 100%로
    # 완전히 포화되지는 않는다 (변별력 유지가 이 교체의 목적).
    assert 90 <= reinhardt_row["percentage"] < 100

    # 다른 후보(합산 점수가 낮은 쪽)는 must-pick이 아니어야 함
    others = [r for r in body["recommendations"] if r["hero_id"] != "reinhardt"]
    assert all(not o["is_must_pick"] for o in others)


def test_recommendations_data_gaps_distinguish_reviewed_neutral_from_unreviewed(client):
    """상대 위도우메이커 기준: 키리코=실제 카운터(값있음, data_gap 없음),
    루시우=검토완료-중립(conftest 시드, data_gap 없음), 모이라/아나=미검토(data_gap 있음)."""
    res = client.post(
        "/api/recommendations",
        json={
            "enemy_heroes": ["widowmaker"],
            "our_heroes": [],
            "empty_position": "support",
            "map_id": "eichenwalde",
        },
    )
    assert res.status_code == 200
    rows = {r["hero_id"]: r for r in res.json()["recommendations"]}

    assert rows["kiriko"]["data_gaps"] == []
    assert rows["lucio"]["data_gaps"] == []
    assert rows["moira"]["data_gaps"] == ["상대 위도우메이커와의 카운터 관계 미검토"]
    assert rows["ana"]["data_gaps"] == ["상대 위도우메이커와의 카운터 관계 미검토"]


def test_recommendations_data_gaps_for_unreviewed_synergy(client):
    """아군 겐지와의 시너지 관계가 검토완료-중립으로도 실제 관계로도 등록 안 된
    후보는 data_gap이 붙어야 한다."""
    res = client.post(
        "/api/recommendations",
        json={
            "enemy_heroes": [],
            "our_heroes": ["genji"],
            "empty_position": "support",
            "map_id": "eichenwalde",
        },
    )
    assert res.status_code == 200
    rows = {r["hero_id"]: r for r in res.json()["recommendations"]}

    assert rows["lucio"]["data_gaps"] == []  # conftest 시드: genji-lucio 시너지 실제 존재
    assert rows["moira"]["data_gaps"] == ["아군 겐지와의 시너지 관계 미검토"]


def test_recommendations_applies_negative_score_when_enemy_counters_candidate(client):
    """conftest 시드: reinhardt가 genji를 카운터하는 행이 있음(반대 방향).
    상대 팀에 라인하르트가 있으면, 겐지 후보는 그 행의 근거로 감점되고
    "미검토"로 잘못 표시되면 안 된다."""
    res = client.post(
        "/api/recommendations",
        json={
            "enemy_heroes": ["reinhardt"],
            "our_heroes": [],
            "empty_position": "damage",
            "map_id": "eichenwalde",
        },
    )
    assert res.status_code == 200
    rows = {r["hero_id"]: r for r in res.json()["recommendations"]}
    genji_row = rows["genji"]
    assert genji_row["score_breakdown"]["counter"] < 0
    assert "화염 강타 한 방으로 즉시 처치 가능한 체력대" in genji_row["reasons"]
    assert genji_row["data_gaps"] == []


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


def test_recommendations_infers_empty_position_from_our_heroes(client):
    """empty_position을 생략하고 우리 팀 4명(탱커1·딜러2·힐러1)만 주면,
    부족한 힐러 자리를 자동으로 판단해서 그 역할의 후보만 추천해야 한다."""
    res = client.post(
        "/api/recommendations",
        json={
            "enemy_heroes": [],
            "our_heroes": ["reinhardt", "genji", "widowmaker", "ana"],
            "map_id": "eichenwalde",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["empty_position"] == "support"
    assert all(r["role"] == "support" for r in body["recommendations"])


def test_recommendations_auto_infer_requires_exactly_four_our_heroes(client):
    """empty_position 생략 + our_heroes가 4명이 아니면 자동 판단이 불가능하므로 400."""
    res = client.post(
        "/api/recommendations",
        json={
            "enemy_heroes": [],
            "our_heroes": ["ana"],
            "map_id": "eichenwalde",
        },
    )
    assert res.status_code == 400


def test_recommendations_auto_infer_rejects_invalid_composition(client):
    """힐러 3명처럼 표준 조합(1·2·2)의 정원을 초과한 구성은 400."""
    res = client.post(
        "/api/recommendations",
        json={
            "enemy_heroes": [],
            "our_heroes": ["kiriko", "lucio", "moira", "genji"],
            "map_id": "eichenwalde",
        },
    )
    assert res.status_code == 400


def test_get_heroes_lang_en_returns_localized_name_and_archetype(client):
    res = client.get("/api/heroes", params={"lang": "en"})
    assert res.status_code == 200
    heroes = {h["id"]: h for h in res.json()}
    assert heroes["kiriko"]["name"] == "Kiriko"
    assert heroes["kiriko"]["archetype"] == "Recon Support"


def test_get_maps_lang_ja_returns_localized_name(client):
    res = client.get("/api/maps", params={"lang": "ja"})
    assert res.status_code == 200
    maps = {m["id"]: m for m in res.json()}
    assert maps["kings_row"]["name"] == "キングスロウ"


def test_recommendations_lang_en_localizes_hero_name_and_reason(client):
    res = client.post(
        "/api/recommendations",
        json={
            "enemy_heroes": ["widowmaker"],
            "our_heroes": ["genji"],
            "empty_position": "support",
            "map_id": "eichenwalde",
            "lang": "en",
        },
    )
    assert res.status_code == 200
    body = res.json()
    top = next(r for r in body["recommendations"] if r["hero_id"] == "kiriko")
    assert top["hero_name"] == "Kiriko"
    assert top["reasons"] == ["Suzu cleanses the sniper's pressure"]


def test_recommendations_lang_ja_localizes_data_gap_message(client):
    """미검토 데이터 갭 문구도 lang에 맞춰 조립되는지 확인 (DB 컬럼이 아니라
    scoring.py에서 직접 조립하는 문구라 별도 테스트가 필요함)."""
    res = client.post(
        "/api/recommendations",
        json={
            "enemy_heroes": ["genji"],
            "our_heroes": ["reinhardt"],
            "empty_position": "damage",
            "map_id": "eichenwalde",
            "lang": "ja",
        },
    )
    assert res.status_code == 200
    body = res.json()
    widowmaker = next(r for r in body["recommendations"] if r["hero_id"] == "widowmaker")
    assert widowmaker["data_gaps"] == [
        "敵のゲンジとのカウンター関係は未検証",
        "味方のラインハルトとのシナジー関係は未検証",
    ]


def test_get_heroes_lang_zh_cn_returns_localized_name(client):
    res = client.get("/api/heroes", params={"lang": "zh-cn"})
    assert res.status_code == 200
    heroes = {h["id"]: h for h in res.json()}
    assert heroes["kiriko"]["name"] == "雾子"
    assert heroes["kiriko"]["archetype"] == "侦察辅助"


def test_get_maps_lang_zh_tw_returns_localized_name(client):
    res = client.get("/api/maps", params={"lang": "zh-tw"})
    assert res.status_code == 200
    maps = {m["id"]: m for m in res.json()}
    assert maps["kings_row"]["name"] == "國王大道"


def test_recommendations_lang_zh_cn_localizes_hero_name_and_reason(client):
    res = client.post(
        "/api/recommendations",
        json={
            "enemy_heroes": ["widowmaker"],
            "our_heroes": ["genji"],
            "empty_position": "support",
            "map_id": "eichenwalde",
            "lang": "zh-cn",
        },
    )
    assert res.status_code == 200
    body = res.json()
    top = next(r for r in body["recommendations"] if r["hero_id"] == "kiriko")
    assert top["hero_name"] == "雾子"
    assert top["reasons"] == ["用铃铛化解狙击手的压制"]


def test_recommendations_lang_zh_tw_localizes_data_gap_message(client):
    res = client.post(
        "/api/recommendations",
        json={
            "enemy_heroes": ["genji"],
            "our_heroes": ["reinhardt"],
            "empty_position": "damage",
            "map_id": "eichenwalde",
            "lang": "zh-tw",
        },
    )
    assert res.status_code == 200
    body = res.json()
    widowmaker = next(r for r in body["recommendations"] if r["hero_id"] == "widowmaker")
    assert widowmaker["data_gaps"] == [
        "與敵方源氏的克制關係尚未評估",
        "與我方萊因哈特的配合關係尚未評估",
    ]
