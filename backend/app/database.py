"""
SQLite 연결 헬퍼. 스펙대로 서비스 런타임에는 외부 API 호출 없이 이 DB만 조회한다.
"""
import sqlite3
from contextlib import contextmanager

from app.config import DB_PATH


def get_connection() -> sqlite3.Connection:
    if not DB_PATH.exists():
        raise FileNotFoundError(
            f"시드 DB를 찾을 수 없습니다: {DB_PATH}. "
            "먼저 seed-data/seed_db.py를 실행해서 overwatch.db를 만들어주세요."
        )
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    # 읽기 전용 서비스라 외래키 제약은 필요 없지만, 켜두면 데이터 무결성 문제를
    # 조기에 발견하기 좋다.
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def db_session():
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()
