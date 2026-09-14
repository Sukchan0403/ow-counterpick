"""
DB 조회 함수들. 여기서 조회한 raw row(dict)를 scoring.py의 순수 함수에 넘겨서
점수를 계산한다 — "DB 조회"와 "점수 계산 로직"을 분리해서, 스코어링 로직만
따로 유닛 테스트하기 쉽게 한다 (스펙의 "테스트 전략" 항목 참고).
"""
import sqlite3

from app.config import MAP_DATA_RICH_THRESHOLD


def fetch_all_heroes(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT id, name, role, archetype, icon_url, archetype_category FROM heroes"
    ).fetchall()


def fetch_heroes_by_role(conn: sqlite3.Connection, role: str) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT id, name, role, archetype, icon_url, archetype_category FROM heroes WHERE role = ?",
        (role,),
    ).fetchall()


def fetch_all_maps_with_richness(conn: sqlite3.Connection) -> list[dict]:
    """맵 목록 + 데이터 풍부도(data_richness). 저장된 값이 아니라 이 맵에 큐레이션된
    map_hero_ratings row 수를 세서 매 요청마다 계산한다 (MapPicker.dc.html의
    '데이터 풍부'/'데이터 보강 중' 배지)."""
    rows = conn.execute(
        """
        SELECT m.id, m.name, m.mode, m.image_url, COUNT(r.hero_id) AS rating_count
        FROM maps m
        LEFT JOIN map_hero_ratings r ON r.map_id = m.id
        GROUP BY m.id, m.name, m.mode, m.image_url
        """
    ).fetchall()
    return [
        {
            "id": row["id"],
            "name": row["name"],
            "mode": row["mode"],
            "image_url": row["image_url"],
            "data_richness": "rich" if row["rating_count"] >= MAP_DATA_RICH_THRESHOLD else "growing",
        }
        for row in rows
    ]


def hero_exists(conn: sqlite3.Connection, hero_id: str) -> bool:
    row = conn.execute("SELECT 1 FROM heroes WHERE id = ?", (hero_id,)).fetchone()
    return row is not None


def map_exists(conn: sqlite3.Connection, map_id: str) -> bool:
    row = conn.execute("SELECT 1 FROM maps WHERE id = ?", (map_id,)).fetchone()
    return row is not None


def fetch_counter_relations_for_candidates(
    conn: sqlite3.Connection, candidate_ids: list[str], enemy_ids: list[str]
) -> list[sqlite3.Row]:
    """candidate_ids 중 누가 enemy_ids 중 누구를 카운터하는지.

    counter_relations는 한 방향으로만 저장되어 있고(hero_id가
    countered_hero_id를 카운터함), "이 후보가 상대 영웅을 카운터하는가"는
    hero_id=후보, countered_hero_id=상대 방향으로만 조회하면 된다
    (seed-data/README.md 참고).
    """
    if not candidate_ids or not enemy_ids:
        return []
    placeholders_c = ",".join("?" for _ in candidate_ids)
    placeholders_e = ",".join("?" for _ in enemy_ids)
    query = f"""
        SELECT hero_id, countered_hero_id, reason
        FROM counter_relations
        WHERE hero_id IN ({placeholders_c})
          AND countered_hero_id IN ({placeholders_e})
    """
    return conn.execute(query, (*candidate_ids, *enemy_ids)).fetchall()


def fetch_synergy_relations_for_candidates(
    conn: sqlite3.Connection, candidate_ids: list[str], ally_ids: list[str]
) -> list[sqlite3.Row]:
    """candidate_ids 중 누가 ally_ids 중 누구와 시너지가 좋은지.

    synergy_relations는 대칭 관계(서로 시너지가 좋음)인데 한쪽 방향으로만
    저장돼 있으므로, (hero_id=후보 AND synergy_hero_id=아군) OR
    (hero_id=아군 AND synergy_hero_id=후보) 양쪽 다 조회해야 놓치지 않는다.
    """
    if not candidate_ids or not ally_ids:
        return []
    placeholders_c = ",".join("?" for _ in candidate_ids)
    placeholders_a = ",".join("?" for _ in ally_ids)
    query = f"""
        SELECT hero_id, synergy_hero_id, reason
        FROM synergy_relations
        WHERE (hero_id IN ({placeholders_c}) AND synergy_hero_id IN ({placeholders_a}))
           OR (hero_id IN ({placeholders_a}) AND synergy_hero_id IN ({placeholders_c}))
    """
    return conn.execute(
        query, (*candidate_ids, *ally_ids, *ally_ids, *candidate_ids)
    ).fetchall()


def fetch_map_ratings_for_candidates(
    conn: sqlite3.Connection, candidate_ids: list[str], map_id: str
) -> list[sqlite3.Row]:
    if not candidate_ids:
        return []
    placeholders = ",".join("?" for _ in candidate_ids)
    query = f"""
        SELECT map_id, hero_id, rating, reason
        FROM map_hero_ratings
        WHERE map_id = ? AND hero_id IN ({placeholders})
    """
    return conn.execute(query, (map_id, *candidate_ids)).fetchall()


def fetch_heroes_by_ids(conn: sqlite3.Connection, hero_ids: list[str]) -> list[sqlite3.Row]:
    if not hero_ids:
        return []
    placeholders = ",".join("?" for _ in hero_ids)
    query = f"SELECT id, name, role, archetype FROM heroes WHERE id IN ({placeholders})"
    return conn.execute(query, tuple(hero_ids)).fetchall()


def fetch_reviewed_neutral_pairs(
    conn: sqlite3.Connection,
    candidate_ids: list[str],
    other_ids: list[str],
    relation_type: str,
) -> list[sqlite3.Row]:
    """ "검토완료-중립" 마커 조회 (결측치 3단 상태). relation_type='counter'는
    hero_id(후보)->other_hero_id(상대) 방향으로만 저장(카운터는 방향성 있는
    관계). relation_type='synergy'는 synergy_relations처럼 양방향으로 저장될
    수 있어 양쪽 다 조회한다."""
    if not candidate_ids or not other_ids:
        return []
    placeholders_c = ",".join("?" for _ in candidate_ids)
    placeholders_o = ",".join("?" for _ in other_ids)

    if relation_type == "counter":
        query = f"""
            SELECT hero_id, other_hero_id
            FROM reviewed_neutral_pairs
            WHERE relation_type = ?
              AND hero_id IN ({placeholders_c}) AND other_hero_id IN ({placeholders_o})
        """
        return conn.execute(query, (relation_type, *candidate_ids, *other_ids)).fetchall()

    query = f"""
        SELECT hero_id, other_hero_id
        FROM reviewed_neutral_pairs
        WHERE relation_type = ?
          AND ((hero_id IN ({placeholders_c}) AND other_hero_id IN ({placeholders_o}))
            OR (hero_id IN ({placeholders_o}) AND other_hero_id IN ({placeholders_c})))
    """
    return conn.execute(
        query, (relation_type, *candidate_ids, *other_ids, *other_ids, *candidate_ids)
    ).fetchall()
