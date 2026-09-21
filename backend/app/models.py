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
Lang = Literal["ko", "en", "ja", "zh-cn", "zh-tw"]


class RecommendationRequest(BaseModel):
    enemy_heroes: list[str] = Field(
        default_factory=list, description="상대 팀이 픽한 영웅 id 목록 (최대 5)"
    )
    our_heroes: list[str] = Field(
        default_factory=list, description="우리 팀이 이미 픽한 영웅 id 목록 (최대 4)"
    )
    empty_position: Role | None = Field(
        default=None,
        description=(
            "채워야 할 빈 포지션. 생략하면 our_heroes 4명의 역할 구성(1탱커·2딜러·2힐러 "
            "기준으로 정확히 한 자리가 빈 경우)을 보고 자동으로 판단한다 — 이 경우 "
            "our_heroes가 정확히 4명이어야 한다."
        ),
    )
    map_id: str = Field(description="맵 id")
    lang: Lang = Field(
        default="ko",
        description="응답에 담길 영웅 이름/아키타입/근거 문구의 언어. hero_id/map_id 등 식별자는 언어와 무관하게 항상 동일.",
    )


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
    data_gaps: list[str] = Field(
        default_factory=list,
        description=(
            "결측치 3단 상태 중 '미검토' 항목만 담긴다 (예: '상대 리퍼와의 카운터 "
            "관계 미검토'). '검토완료-중립'은 조용히 0점 처리되고 여기 안 담긴다."
        ),
    )


class RecommendationResponse(BaseModel):
    recommendations: list[HeroRecommendation]
    empty_position: Role = Field(
        description="실제로 추천에 사용된 포지션. 요청에서 생략됐으면 자동 판단된 값."
    )
    notice: str | None = Field(
        default=None,
        description="상대/우리 팀 픽 정보가 없을 때 등 추천 근거가 제한적임을 알리는 안내 문구",
    )


class TeamEvaluationRequest(BaseModel):
    """드래프트 시뮬레이션(사전 팀 평가) 모드 — 실시간 밴프준 보조와 달리 양 팀
    5명이 이미 다 확정된 상태를 입력받는다. 설계 문서의
    "사전 드래프트 시뮬레이션 모드" 절 참고."""

    enemy_heroes: list[str] = Field(description="상대 팀 5명 (탱커1·딜러2·힐러2)")
    our_heroes: list[str] = Field(description="우리 팀 5명 (탱커1·딜러2·힐러2)")
    map_id: str = Field(description="맵 id")
    lang: Lang = Field(default="ko", description="응답 텍스트 언어")


class TeamEvaluationResponse(BaseModel):
    team_percentage: int = Field(
        description=(
            "우리 팀 5명 각자의 percentage를 config.ROLE_INFLUENCE_WEIGHT(탱커>딜러>힐러) "
            "가중 평균으로 합친 팀 종합 점수."
        )
    )
    evaluations: list[HeroRecommendation] = Field(
        description="우리 팀 5명 각각의 평가. role 순서(탱커→딜러→힐러)로 정렬됨."
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
        default="",
        description="블리자드 CDN 초상화 URL. OverFast API에서 확보해 시드에 저장하고 런타임엔 그대로 핫링크.",
    )
    archetype_category: str = Field(
        default="",
        description="그룹 필터링용 상위 분류(예: '의무관', '개시자'). 스펙의 아키타입 카테고리 표 참고.",
    )


class MapOut(BaseModel):
    id: str
    name: str
    mode: str
    image_url: str = Field(default="", description="맵 스크린샷 URL. OverFast API에서 확보해 시드에 저장.")
    data_richness: DataRichness = Field(
        description=(
            "MapPicker.dc.html의 '데이터 풍부'/'데이터 보강 중' 배지. 저장된 값이 아니라 "
            "이 맵에 큐레이션된 map_hero_ratings row 수를 세서 매 요청마다 계산한다."
        )
    )


class MetaOut(BaseModel):
    season: str = Field(description="Main.dc.html 헤더 배지 '시즌 4 시드 데이터 · v0.3'의 '시즌 4' 부분")
    data_version: str = Field(description="같은 배지의 'v0.3' 부분. 시드 데이터를 갱신할 때 같이 올린다.")
