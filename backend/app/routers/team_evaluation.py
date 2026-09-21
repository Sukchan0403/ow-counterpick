"""POST /api/team-evaluation — 드래프트 시뮬레이션(사전 팀 평가) 모드.

설계 문서의 "사전 드래프트 시뮬레이션 모드" 절 그대로 구현. 실시간 밴프준
보조(POST /api/recommendations)와 점수 계산 로직 자체는 완전히 같다 — 차이는
후보군이 "포지션에 맞는 전체 영웅 풀"이 아니라 "이미 다 확정된 우리 팀 5명,
그 5명뿐"이라는 것. 그래서 score_candidates()를 새로 만들지 않고 그대로
재사용하되, 팀원 한 명씩 candidates=[그 영웅]으로 5번 호출한다 — ally_ids(같은
팀 나머지 4명)가 팀원마다 달라서(자기 자신 제외) 한 번에 배치 처리할 수 없다.
"""
from fastapi import APIRouter, HTTPException

from app.composition import InvalidTeamCompositionError, assert_full_team_composition
from app.config import TEAM_ROLE_COMPOSITION
from app.database import db_session
from app.models import (
    HeroRecommendation,
    ScoreBreakdown,
    TeamEvaluationRequest,
    TeamEvaluationResponse,
)
from app.repository import (
    fetch_counter_relations_for_candidates,
    fetch_heroes_by_ids,
    fetch_map_ratings_for_candidates,
    fetch_reviewed_neutral_pairs,
    fetch_synergy_relations_for_candidates,
    hero_exists,
    map_exists,
)
from app.scoring import aggregate_team_percentage, score_candidates

router = APIRouter(prefix="/api", tags=["team-evaluation"])

# 정렬 기준(탱커→딜러→힐러). TEAM_ROLE_COMPOSITION의 삽입 순서를 그대로 쓴다 —
# role 표시 순서를 이 파일에서 또 하드코딩하지 않기 위함.
_ROLE_ORDER = list(TEAM_ROLE_COMPOSITION)


@router.post("/team-evaluation", response_model=TeamEvaluationResponse)
def post_team_evaluation(payload: TeamEvaluationRequest):
    with db_session() as conn:
        # --- 입력 검증 ---
        if not map_exists(conn, payload.map_id):
            raise HTTPException(status_code=400, detail=f"알 수 없는 맵입니다: {payload.map_id}")

        for hero_id in [*payload.enemy_heroes, *payload.our_heroes]:
            if not hero_exists(conn, hero_id):
                raise HTTPException(status_code=400, detail=f"알 수 없는 영웅입니다: {hero_id}")

        if len(payload.enemy_heroes) != 5 or len(payload.our_heroes) != 5:
            raise HTTPException(
                status_code=400,
                detail="드래프트 시뮬레이션은 양 팀 모두 정확히 5명씩 입력해야 합니다.",
            )

        enemy_roles = {r["id"]: r["role"] for r in fetch_heroes_by_ids(conn, payload.enemy_heroes)}
        our_hero_rows = {r["id"]: r for r in fetch_heroes_by_ids(conn, payload.our_heroes, lang=payload.lang)}
        try:
            assert_full_team_composition("상대 팀", list(enemy_roles.values()))
            assert_full_team_composition("우리 팀", [r["role"] for r in our_hero_rows.values()])
        except InvalidTeamCompositionError as exc:
            raise HTTPException(status_code=400, detail=exc.message) from exc

        # --- 관계 데이터는 우리 팀 5명 전체를 대상으로 한 번씩만 조회한다.
        # score_candidates()는 candidate별로 counter_by_hero.get(cid, [])처럼
        # 알아서 걸러 쓰므로, 5번 호출 전체에 같은 pre-fetch 결과를 재사용해도
        # 정확하다 — 매번 다시 쿼리할 필요 없음.
        counter_rows = [
            dict(r)
            for r in fetch_counter_relations_for_candidates(
                conn, payload.our_heroes, payload.enemy_heroes, lang=payload.lang
            )
        ]
        countered_by_rows = [
            dict(r)
            for r in fetch_counter_relations_for_candidates(
                conn, payload.enemy_heroes, payload.our_heroes, lang=payload.lang
            )
        ]
        synergy_rows = [
            dict(r)
            for r in fetch_synergy_relations_for_candidates(
                conn, payload.our_heroes, payload.our_heroes, lang=payload.lang
            )
        ]
        map_rows = [
            dict(r)
            for r in fetch_map_ratings_for_candidates(
                conn, payload.our_heroes, payload.map_id, lang=payload.lang
            )
        ]
        reviewed_neutral_counter = [
            dict(r)
            for r in fetch_reviewed_neutral_pairs(
                conn, payload.our_heroes, payload.enemy_heroes, "counter"
            )
        ]
        reviewed_neutral_synergy = [
            dict(r)
            for r in fetch_reviewed_neutral_pairs(conn, payload.our_heroes, payload.our_heroes, "synergy")
        ]
        id_to_name = {
            r["id"]: r["name"]
            for r in fetch_heroes_by_ids(
                conn, [*payload.enemy_heroes, *payload.our_heroes], lang=payload.lang
            )
        }

    scored_by_hero = {}
    for hero_id, hero_row in our_hero_rows.items():
        candidate = {
            "id": hero_row["id"],
            "name": hero_row["name"],
            "role": hero_row["role"],
            "archetype": hero_row["archetype"],
            "icon_url": hero_row["icon_url"],
            "archetype_category": hero_row["archetype_category"],
        }
        ally_ids = [h for h in payload.our_heroes if h != hero_id]
        scored = score_candidates(
            [candidate],
            counter_rows,
            synergy_rows,
            map_rows,
            enemy_ids=payload.enemy_heroes,
            ally_ids=ally_ids,
            reviewed_neutral_counter_pairs=reviewed_neutral_counter,
            reviewed_neutral_synergy_pairs=reviewed_neutral_synergy,
            countered_by_rows=countered_by_rows,
            id_to_name=id_to_name,
            lang=payload.lang,
        )[0]
        scored_by_hero[hero_id] = scored

    team_percentage = aggregate_team_percentage(list(scored_by_hero.values()))

    evaluations = [
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
        # 원래 our_heroes 순서가 아니라 role 순서(탱커→딜러→힐러)로 정렬해서 보여준다.
        for s in sorted(
            scored_by_hero.values(), key=lambda s: _ROLE_ORDER.index(s.role)
        )
    ]

    return TeamEvaluationResponse(team_percentage=team_percentage, evaluations=evaluations)
