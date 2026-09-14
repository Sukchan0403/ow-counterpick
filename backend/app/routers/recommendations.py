"""POST /api/recommendations — 스펙의 핵심 엔드포인트."""
from fastapi import APIRouter, HTTPException

from app.database import db_session
from app.models import (
    HeroRecommendation,
    RecommendationRequest,
    RecommendationResponse,
    ScoreBreakdown,
)
from app.repository import (
    fetch_counter_relations_for_candidates,
    fetch_heroes_by_ids,
    fetch_heroes_by_role,
    fetch_map_ratings_for_candidates,
    fetch_reviewed_neutral_pairs,
    fetch_synergy_relations_for_candidates,
    hero_exists,
    map_exists,
)
from app.scoring import score_candidates

router = APIRouter(prefix="/api", tags=["recommendations"])

TOP_N = 5

NO_PICKS_NOTICE = (
    "상대·우리 팀 픽 정보가 없어 맵 데이터만 반영된 추천이에요. "
    "픽 정보를 입력하면 카운터·시너지 근거도 함께 볼 수 있어요."
)


@router.post("/recommendations", response_model=RecommendationResponse)
def post_recommendations(payload: RecommendationRequest):
    with db_session() as conn:
        # --- 입력 검증 (스펙 "에러 처리" 표) ---
        if not map_exists(conn, payload.map_id):
            raise HTTPException(status_code=400, detail=f"알 수 없는 맵입니다: {payload.map_id}")

        for hero_id in [*payload.enemy_heroes, *payload.our_heroes]:
            if not hero_exists(conn, hero_id):
                raise HTTPException(status_code=400, detail=f"알 수 없는 영웅입니다: {hero_id}")

        if len(payload.enemy_heroes) > 5:
            raise HTTPException(status_code=400, detail="상대 팀 픽은 최대 5명까지입니다.")
        if len(payload.our_heroes) > 4:
            raise HTTPException(status_code=400, detail="우리 팀 픽은 최대 4명까지입니다.")

        # 오버워치 경쟁전 규칙상 "영웅 1인 1팀" 제한은 팀 내부에서만 적용된다 —
        # 상대 팀이 이미 픽한 영웅이라도 우리 팀은 같은 영웅을 픽할 수 있다(미러 픽).
        # 그래서 후보군에서 제외할 건 "우리 팀이 이미 픽한 영웅"만이지,
        # 상대 팀 픽까지 제외하면 안 된다.
        already_picked = set(payload.our_heroes)

        # --- 후보 조회: 빈 포지션에 해당하는, 아직 안 나온 영웅 전부 ---
        role_heroes = fetch_heroes_by_role(conn, payload.empty_position)
        candidates = [
            {
                "id": r["id"],
                "name": r["name"],
                "role": r["role"],
                "archetype": r["archetype"],
                "icon_url": r["icon_url"],
                "archetype_category": r["archetype_category"],
            }
            for r in role_heroes
            if r["id"] not in already_picked
        ]
        candidate_ids = [c["id"] for c in candidates]

        counter_rows = [
            dict(r)
            for r in fetch_counter_relations_for_candidates(
                conn, candidate_ids, payload.enemy_heroes
            )
        ]
        synergy_rows = [
            dict(r)
            for r in fetch_synergy_relations_for_candidates(
                conn, candidate_ids, payload.our_heroes
            )
        ]
        map_rows = [
            dict(r)
            for r in fetch_map_ratings_for_candidates(conn, candidate_ids, payload.map_id)
        ]
        reviewed_neutral_counter = [
            dict(r)
            for r in fetch_reviewed_neutral_pairs(
                conn, candidate_ids, payload.enemy_heroes, "counter"
            )
        ]
        reviewed_neutral_synergy = [
            dict(r)
            for r in fetch_reviewed_neutral_pairs(
                conn, candidate_ids, payload.our_heroes, "synergy"
            )
        ]
        id_to_name = {
            r["id"]: r["name"]
            for r in fetch_heroes_by_ids(conn, [*payload.enemy_heroes, *payload.our_heroes])
        }

    scored = score_candidates(
        candidates,
        counter_rows,
        synergy_rows,
        map_rows,
        enemy_ids=payload.enemy_heroes,
        ally_ids=payload.our_heroes,
        reviewed_neutral_counter_pairs=reviewed_neutral_counter,
        reviewed_neutral_synergy_pairs=reviewed_neutral_synergy,
        id_to_name=id_to_name,
    )

    recommendations = [
        HeroRecommendation(
            hero_id=s.hero_id,
            hero_name=s.hero_name,
            role=s.role,
            archetype=s.archetype,
            total_score=s.total_score,
            percentage=s.percentage,
            score_breakdown=ScoreBreakdown(
                counter=s.counter_score, synergy=s.synergy_score, map=s.map_score
            ),
            reasons=s.reasons,
            is_must_pick=s.is_must_pick,
            notes=s.notes,
            icon_url=s.icon_url,
            archetype_category=s.archetype_category,
            data_gaps=s.data_gaps,
        )
        for s in scored[:TOP_N]
    ]

    notice = None
    if not payload.enemy_heroes and not payload.our_heroes:
        notice = NO_PICKS_NOTICE

    return RecommendationResponse(recommendations=recommendations, notice=notice)
