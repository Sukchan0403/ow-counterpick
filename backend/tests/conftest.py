"""
API 통합 테스트용 fixture DB. 진짜 시드 데이터(15영웅)와 별개로, 테스트가
언제나 같은 결과를 내도록 아주 작고 고정된 데이터셋을 여기서 직접 만든다.

주의: app.config가 import 시점에 OW_DB_PATH 환경변수를 읽으므로, 이 파일의
최상위(모듈 레벨) 코드가 test_api.py에서 `from app.main import app`을 하기
"전에" 먼저 실행되도록 pytest가 conftest.py를 항상 먼저 수집한다는 점을 이용한다.
"""
import os
import sqlite3
import tempfile
from pathlib import Path

_tmp_dir = tempfile.mkdtemp(prefix="ow_backend_test_")
_TEST_DB_PATH = Path(_tmp_dir) / "test_overwatch.db"
os.environ["OW_DB_PATH"] = str(_TEST_DB_PATH)

_SCHEMA = """
CREATE TABLE heroes (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('tank','damage','support')),
    archetype TEXT NOT NULL DEFAULT ''
);
CREATE TABLE maps (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, mode TEXT NOT NULL
);
CREATE TABLE counter_relations (
    hero_id TEXT NOT NULL REFERENCES heroes(id),
    countered_hero_id TEXT NOT NULL REFERENCES heroes(id),
    reason TEXT NOT NULL,
    PRIMARY KEY (hero_id, countered_hero_id)
);
CREATE TABLE synergy_relations (
    hero_id TEXT NOT NULL REFERENCES heroes(id),
    synergy_hero_id TEXT NOT NULL REFERENCES heroes(id),
    reason TEXT NOT NULL,
    PRIMARY KEY (hero_id, synergy_hero_id)
);
CREATE TABLE map_hero_ratings (
    map_id TEXT NOT NULL REFERENCES maps(id),
    hero_id TEXT NOT NULL REFERENCES heroes(id),
    rating TEXT NOT NULL CHECK (rating IN ('강함','보통','약함')),
    reason TEXT NOT NULL,
    PRIMARY KEY (map_id, hero_id)
);
CREATE TABLE reviewed_neutral_pairs (
    hero_id TEXT NOT NULL REFERENCES heroes(id),
    other_hero_id TEXT NOT NULL REFERENCES heroes(id),
    relation_type TEXT NOT NULL CHECK (relation_type IN ('counter','synergy')),
    PRIMARY KEY (hero_id, other_hero_id, relation_type)
);
"""

_conn = sqlite3.connect(str(_TEST_DB_PATH))
_conn.executescript(_SCHEMA)
_conn.executemany(
    "INSERT INTO heroes VALUES (?, ?, ?, ?)",
    [
        ("kiriko", "키리코", "support", "정찰 지원"),
        ("lucio", "루시우", "support", "기동 지원"),
        ("moira", "모이라", "support", "근접 유지 지원"),
        ("ana", "아나", "support", "디나이얼 지원"),
        ("widowmaker", "위도우메이커", "damage", "저격수"),
        ("genji", "겐지", "damage", "근접 플랭커"),
        ("reinhardt", "라인하르트", "tank", "방벽 수문장"),
    ],
)
_conn.executemany(
    "INSERT INTO maps VALUES (?, ?, ?)",
    [("eichenwalde", "아이헨발데", "혼합"), ("kings_row", "왕의 길", "혼합")],
)
_conn.executemany(
    "INSERT INTO counter_relations VALUES (?, ?, ?)",
    [
        ("kiriko", "widowmaker", "스즈로 저격 견제를 무효화"),
        # is_must_pick(percentage>=90) 테스트용: 카운터+시너지+맵 강함이 한 후보에 다 몰리는 경우
        ("reinhardt", "genji", "화염 강타 한 방으로 즉시 처치 가능한 체력대"),
    ],
)
_conn.executemany(
    "INSERT INTO synergy_relations VALUES (?, ?, ?)",
    [
        ("genji", "lucio", "속도 부스트로 진입 타이밍이 잘 맞음"),
        ("reinhardt", "ana", "나노 강화를 받은 화염 강타로 확정 이니시"),
    ],
)
_conn.executemany(
    "INSERT INTO map_hero_ratings VALUES (?, ?, ?, ?)",
    [
        # eichenwalde: 1건 -> data_richness "growing" (MAP_DATA_RICH_THRESHOLD=3 미만)
        ("eichenwalde", "moira", "강함", "실내 구간에서 유지력 좋음"),
        # kings_row: 3건 -> data_richness "rich"
        ("kings_row", "reinhardt", "강함", "좁은 골목 구간을 방벽으로 틀어막기 좋음"),
        ("kings_row", "genji", "약함", "장거리 구간에서 견제에 노출되기 쉬움"),
        ("kings_row", "moira", "강함", "실내 구간에서 유지력 좋음"),
    ],
)
_conn.executemany(
    "INSERT INTO reviewed_neutral_pairs VALUES (?, ?, ?)",
    [
        # Task 4의 API 테스트에서 "검토완료-중립"(data_gap 없음)을 확인하는 데 사용
        ("lucio", "widowmaker", "counter"),
        ("kiriko", "moira", "synergy"),
    ],
)
_conn.commit()
_conn.close()


import pytest  # noqa: E402  (환경변수 설정 이후에 import 해야 함)
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def conn():
    connection = sqlite3.connect(str(_TEST_DB_PATH))
    connection.row_factory = sqlite3.Row
    try:
        yield connection
    finally:
        connection.close()
