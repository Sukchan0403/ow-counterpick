"""
요청/응답 Pydantic 모델. 필드 구성은 목업(Main/Result.dc.html/ResultNeutral.dc.html/
MapPicker.dc.html)의 표시 항목과 1:1로 맞춘다 — 이 파일을 고칠 때는 반드시
docs/superpowers/specs/2026-09-07-overwatch-hero-recommender-design.md의
"API 명세" 표도 같이 업데이트할 것.
"""
from typing import Literal

from pydantic import BaseModel, Field

Role = Literal["tank", "damage", "support"]
DataRichness = Literal["rich", "growing"]


class RecommendationRequest(BaseModel):
    enemy_heroes: list[str] = Field(
        default_factory=list, description="상대 팀이 픽한 영웅 id 목록 (최대 5)"
    )
    our_heroes: list[str] = Field(
        default_factory=list, description="우리 팀이 이미 픽한 영웅 id 목록 (최대 4)"
    )
    empty_position: Role = Field(description="채워야 할 빈 포지션")
    map_id: str = Field(description="맵 id")


class ScoreBreakdown(BaseModel):
    counter: int
    synergy: int
    map: int


class HeroRecommendation(BaseModel):
    hero_id: str
    hero_name: str
    role: Role
    archetype: str = Field(
        description="Result.dc.html의 '지원 · 정찰 지원' 같은 서브타이틀. HeroOut.archetype과 동일 값."
    )
    icon_url: str = Field(default="", description="블리자드 CDN 초상화 URL 핫링크용")
    archetype_category: str = Field(default="", description="그룹 필터링용 상위 분류")
    total_score: int
    percentage: int
    score_breakdown: ScoreBreakdown
    reasons: list[str]
    # --- 목업 필드 완결성 점검 후 추가된 필드 (아래 3개) ---
    is_must_pick: bool = Field(
        default=False,
        description=(
            "Result.dc.html의 '필수픽' 배지. percentage가 "
            "MUST_PICK_PERCENTAGE_THRESHOLD 이상이면 true."
        ),
    )
    notes: list[str] = Field(
        default_factory=list,
        description=(
            "reasons(카운터/시너지/맵 매치 근거)와 별개로, 목업에 예시로 나온 "
            "'최근 패치 이후 픽률 상승세' 같은 트렌드/주의사항 코멘트용 필드. "
            "지금 시드 데이터에는 이런 메타 코멘트가 큐레이션돼 있지 않아서 "
            "현재는 항상 빈 배열 — 스키마만 먼저 맞춰둔 상태."
        ),
    )


class RecommendationResponse(BaseModel):
    recommendations: list[HeroRecommendation]
    notice: str | None = Field(
        default=None,
        description="상대/우리 팀 픽 정보가 없을 때 등 추천 근거가 제한적임을 알리는 안내 문구",
    )


class HeroOut(BaseModel):
    id: str
    name: str
    role: Role
    archetype: str = Field(
        description="역할 세부 서브타이틀 (예: '정찰 지원', '방벽 수문장'). Main/Result 목업의 "
        "'지원 · 정찰 지원' 같은 표시에 쓰임."
    )
    icon_url: str = Field(
        description="블리자드 CDN 초상화 URL. OverFast API에서 확보해 시드에 저장하고 런타임엔 그대로 핫링크."
    )
    archetype_category: str = Field(
        description="그룹 필터링용 상위 분류(예: '의무관', '개시자'). 스펙의 아키타입 카테고리 표 참고."
    )


class MapOut(BaseModel):
    id: str
    name: str
    mode: str
    data_richness: DataRichness = Field(
        description=(
            "MapPicker.dc.html의 '데이터 풍부'/'데이터 보강 중' 배지. 저장된 값이 아니라 "
            "이 맵에 큐레이션된 map_hero_ratings row 수를 세서 매 요청마다 계산한다."
        )
    )


class MetaOut(BaseModel):
    season: str = Field(description="Main.dc.html 헤더 배지 '시즌 4 시드 데이터 · v0.3'의 '시즌 4' 부분")
    data_version: str = Field(description="같은 배지의 'v0.3' 부분. 시드 데이터를 갱신할 때 같이 올린다.")
