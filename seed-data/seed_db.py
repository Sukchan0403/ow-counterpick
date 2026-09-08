"""
오버워치 밴프준 보조 서비스 - 시드 데이터 로더

스펙 문서의 DB 스키마(heroes / maps / counter_relations / synergy_relations /
map_hero_ratings)를 그대로 만들고, 같은 폴더의 JSON 파일들을 읽어 채워 넣는다.

사용법:
    python3 seed_db.py [출력할 db 경로, 기본값: overwatch.db]
"""

import json
import sqlite3
import sys
from pathlib import Path

HERE = Path(__file__).parent


def load(name):
    with open(HERE / name, encoding="utf-8") as f:
        return json.load(f)


SCHEMA = """
CREATE TABLE IF NOT EXISTS heroes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('tank', 'damage', 'support')),
    archetype TEXT NOT NULL DEFAULT '',
    icon_url TEXT NOT NULL DEFAULT '',
    archetype_category TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS maps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mode TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS counter_relations (
    hero_id TEXT NOT NULL REFERENCES heroes(id),
    countered_hero_id TEXT NOT NULL REFERENCES heroes(id),
    reason TEXT NOT NULL,
    PRIMARY KEY (hero_id, countered_hero_id)
);

CREATE TABLE IF NOT EXISTS synergy_relations (
    hero_id TEXT NOT NULL REFERENCES heroes(id),
    synergy_hero_id TEXT NOT NULL REFERENCES heroes(id),
    reason TEXT NOT NULL,
    PRIMARY KEY (hero_id, synergy_hero_id)
);

CREATE TABLE IF NOT EXISTS map_hero_ratings (
    map_id TEXT NOT NULL REFERENCES maps(id),
    hero_id TEXT NOT NULL REFERENCES heroes(id),
    rating TEXT NOT NULL CHECK (rating IN ('강함', '보통', '약함')),
    reason TEXT NOT NULL,
    PRIMARY KEY (map_id, hero_id)
);
"""


def main():
    db_path = sys.argv[1] if len(sys.argv) > 1 else "overwatch.db"
    heroes = load("heroes.json")
    maps = load("maps.json")
    counters = load("counter_relations.json")
    synergies = load("synergy_relations.json")
    map_ratings = load("map_hero_ratings.json")

    conn = sqlite3.connect(db_path)
    conn.executescript(SCHEMA)

    # 마이그레이션: v0 스키마로 이미 만들어진 DB 파일에는 archetype 컬럼이 없을 수
    # 있음(CREATE TABLE IF NOT EXISTS라 기존 테이블은 안 바뀜). 없으면 추가.
    existing_cols = {row[1] for row in conn.execute("PRAGMA table_info(heroes)")}
    if "archetype" not in existing_cols:
        conn.execute("ALTER TABLE heroes ADD COLUMN archetype TEXT NOT NULL DEFAULT ''")
    if "icon_url" not in existing_cols:
        conn.execute("ALTER TABLE heroes ADD COLUMN icon_url TEXT NOT NULL DEFAULT ''")
    if "archetype_category" not in existing_cols:
        conn.execute("ALTER TABLE heroes ADD COLUMN archetype_category TEXT NOT NULL DEFAULT ''")

    conn.executemany(
        "INSERT OR REPLACE INTO heroes (id, name, role, archetype, icon_url, archetype_category) "
        "VALUES (:id, :name, :role, :archetype, :icon_url, :archetype_category)",
        heroes,
    )
    conn.executemany(
        "INSERT OR REPLACE INTO maps (id, name, mode) VALUES (:id, :name, :mode)",
        maps,
    )
    conn.executemany(
        """INSERT OR REPLACE INTO counter_relations
           (hero_id, countered_hero_id, reason)
           VALUES (:hero_id, :countered_hero_id, :reason)""",
        counters,
    )
    conn.executemany(
        """INSERT OR REPLACE INTO synergy_relations
           (hero_id, synergy_hero_id, reason)
           VALUES (:hero_id, :synergy_hero_id, :reason)""",
        synergies,
    )
    conn.executemany(
        """INSERT OR REPLACE INTO map_hero_ratings
           (map_id, hero_id, rating, reason)
           VALUES (:map_id, :hero_id, :rating, :reason)""",
        map_ratings,
    )
    conn.commit()

    print(f"완료: {db_path}")
    print(f"  heroes: {len(heroes)}")
    print(f"  maps: {len(maps)}")
    print(f"  counter_relations: {len(counters)}")
    print(f"  synergy_relations: {len(synergies)}")
    print(f"  map_hero_ratings: {len(map_ratings)}")

    # 간단한 무결성 체크: 관계 테이블이 참조하는 hero_id/map_id가 실제로 존재하는지
    hero_ids = {h["id"] for h in heroes}
    map_ids = {m["id"] for m in maps}
    problems = []
    for c in counters:
        if c["hero_id"] not in hero_ids or c["countered_hero_id"] not in hero_ids:
            problems.append(("counter_relations", c))
    for s in synergies:
        if s["hero_id"] not in hero_ids or s["synergy_hero_id"] not in hero_ids:
            problems.append(("synergy_relations", s))
    for r in map_ratings:
        if r["hero_id"] not in hero_ids or r["map_id"] not in map_ids:
            problems.append(("map_hero_ratings", r))

    # archetype_category 유효성 체크: 역할별로 정해진 하위 집합만 유효 (스펙의
    # "아키타입 카테고리" 표 참고). 값이 비어있으면(아직 미배정) 통과 처리.
    ALLOWED_ARCHETYPE_CATEGORIES = {
        "tank": {"개시자", "투사", "강건한 자"},
        "damage": {"전문가", "수색가", "측면 공격가", "명사수"},
        "support": {"전술가", "의무관", "생존왕"},
    }
    for h in heroes:
        category = h.get("archetype_category", "")
        if category and category not in ALLOWED_ARCHETYPE_CATEGORIES.get(h["role"], set()):
            problems.append(("heroes.archetype_category", h))

    if problems:
        print(f"\n경고: 참조 무결성 문제 {len(problems)}건")
        for table, row in problems:
            print(f"  [{table}] {row}")
    else:
        print("\n무결성 체크 통과: 모든 관계 데이터의 hero_id/map_id 및 영웅 archetype_category가 유효함")

    conn.close()


if __name__ == "__main__":
    main()
