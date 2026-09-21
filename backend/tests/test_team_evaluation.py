"""POST /api/team-evaluation 라우트 테스트 (드래프트 시뮬레이션 모드).

fixture DB(conftest.py)에는 탱커가 reinhardt 하나뿐이라, 표준 5인 조합
(탱커1·딜러2·힐러2)을 양 팀에 다 채우려면 탱커/딜러는 미러 픽(같은 영웅이
양 팀에 다 있음)을 써야 한다 — 오버워치 룰상 허용되는 상황이라 실제
프로덕션 코드와 다르게 취급할 이유가 없다.
"""

ENEMY_TEAM = ["reinhardt", "widowmaker", "genji", "kiriko", "lucio"]
OUR_TEAM = ["reinhardt", "widowmaker", "genji", "moira", "ana"]


def test_team_evaluation_happy_path_returns_five_evaluations_sorted_by_role(client):
    res = client.post(
        "/api/team-evaluation",
        json={"enemy_heroes": ENEMY_TEAM, "our_heroes": OUR_TEAM, "map_id": "kings_row"},
    )
    assert res.status_code == 200
    body = res.json()

    assert 0 <= body["team_percentage"] <= 100
    assert len(body["evaluations"]) == 5
    assert {e["hero_id"] for e in body["evaluations"]} == set(OUR_TEAM)
    # role 순서(탱커→딜러→딜러→힐러→힐러)로 정렬돼야 함
    assert [e["role"] for e in body["evaluations"]] == [
        "tank", "damage", "damage", "support", "support",
    ]


def test_team_evaluation_applies_counter_synergy_and_map_score_correctly(client):
    res = client.post(
        "/api/team-evaluation",
        json={"enemy_heroes": ENEMY_TEAM, "our_heroes": OUR_TEAM, "map_id": "kings_row"},
    )
    body = res.json()
    by_id = {e["hero_id"]: e for e in body["evaluations"]}

    # reinhardt: genji(상대)를 카운터(+60) + ana(아군)와 시너지(+10) +
    # kings_row 맵 강함(+15) = 85
    reinhardt = by_id["reinhardt"]
    assert reinhardt["score_breakdown"] == {"counter": 60, "synergy": 10, "map": 15}
    assert reinhardt["total_score"] == 85

    # moira: 카운터/시너지 관계 없음, kings_row 맵 강함(+15)만
    moira = by_id["moira"]
    assert moira["score_breakdown"] == {"counter": 0, "synergy": 0, "map": 15}


def test_team_evaluation_requires_exactly_five_per_team(client):
    res = client.post(
        "/api/team-evaluation",
        json={"enemy_heroes": ENEMY_TEAM[:4], "our_heroes": OUR_TEAM, "map_id": "kings_row"},
    )
    assert res.status_code == 400


def test_team_evaluation_rejects_non_standard_composition(client):
    # 탱커(reinhardt)를 딜러 자리 대신 또 넣어서 탱커 2명짜리 비표준 조합을 만듦
    bad_our_team = ["reinhardt", "reinhardt", "genji", "moira", "ana"]
    res = client.post(
        "/api/team-evaluation",
        json={"enemy_heroes": ENEMY_TEAM, "our_heroes": bad_our_team, "map_id": "kings_row"},
    )
    assert res.status_code == 400
    assert "우리 팀" in res.json()["detail"]


def test_team_evaluation_unknown_hero_returns_400(client):
    res = client.post(
        "/api/team-evaluation",
        json={
            "enemy_heroes": ENEMY_TEAM,
            "our_heroes": ["존재하지않는영웅", "widowmaker", "genji", "moira", "ana"],
            "map_id": "kings_row",
        },
    )
    assert res.status_code == 400


def test_team_evaluation_unknown_map_returns_400(client):
    res = client.post(
        "/api/team-evaluation",
        json={"enemy_heroes": ENEMY_TEAM, "our_heroes": OUR_TEAM, "map_id": "존재하지않는맵"},
    )
    assert res.status_code == 400


def test_team_evaluation_missing_required_field_returns_422(client):
    res = client.post("/api/team-evaluation", json={"our_heroes": OUR_TEAM, "map_id": "kings_row"})
    assert res.status_code == 422
