"""GET /api/heroes, GET /api/maps, GET /api/meta — 프론트 입력 폼의 선택 목록/상단 배지용."""
from fastapi import APIRouter

from app import config
from app.database import db_session
from app.models import HeroOut, MapOut, MetaOut
from app.repository import fetch_all_heroes, fetch_all_maps_with_richness

router = APIRouter(prefix="/api", tags=["catalog"])


@router.get("/heroes", response_model=list[HeroOut])
def get_heroes():
    with db_session() as conn:
        rows = fetch_all_heroes(conn)
        return [
            HeroOut(id=r["id"], name=r["name"], role=r["role"], archetype=r["archetype"])
            for r in rows
        ]


@router.get("/maps", response_model=list[MapOut])
def get_maps():
    with db_session() as conn:
        rows = fetch_all_maps_with_richness(conn)
        return [MapOut(**row) for row in rows]


@router.get("/meta", response_model=MetaOut)
def get_meta():
    """Main.dc.html 헤더의 '시즌 4 시드 데이터 · v0.3' 배지용. DB 조회 없이
    config.py에 정적으로 박아둔 시드 데이터 버전 정보를 그대로 내려준다."""
    return MetaOut(season=config.SEED_SEASON, data_version=config.SEED_DATA_VERSION)
