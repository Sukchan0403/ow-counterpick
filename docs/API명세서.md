# 오버워치 밴프준 보조 서비스 — API 명세서

- 프로젝트: 오버워치 밴프준 보조 웹서비스 (ow-counterpick)
- 저장소: https://github.com/Sukchan0403/ow-counterpick
- 기준: `master` 브랜치의 현재 구현 (`backend/app/`) — 설계 문서
  (`docs/superpowers/specs/2026-09-07-overwatch-hero-recommender-design.md`)의
  "API 명세 (상세)" 섹션을 실제 코드·테스트(`backend/tests/`)와 대조해 정리
- 베이스 URL(로컬 개발): `http://localhost:8000`

## 엔드포인트 개요

| 메서드 | 경로 | 설명 | 요청 스키마 | 응답 스키마 | 상태 코드 |
|---|---|---|---|---|---|
| GET | `/api/heroes` | 영웅 목록 조회 | - | `Hero[]` | 200, 502 |
| GET | `/api/maps` | 맵 목록 조회 | - | `Map[]` | 200, 502 |
| GET | `/api/meta` | 시드 데이터 시즌/버전 정보 | - | `Meta` | 200, 502 |
| POST | `/api/recommendations` | 빈 포지션 추천 영웅 순위 조회 | `RecommendationRequest` | `RecommendationResponse` | 200, 400, 422, 502 |

- **422**: `empty_position` 또는 `map_id`가 요청 본문에 아예 없을 때 (pydantic 검증 실패)
- **400**: 요청 형식은 맞지만 `enemy_heroes`/`our_heroes`/`map_id`에 존재하지 않는 id가
  섞여 있거나, 팀 인원 제한(상대 5명/우리 4명)을 초과했을 때
- **502**: 예상 못 한 서버 오류 (`main.py`의 전역 예외 핸들러가 통일 처리)

## 스키마

### Hero (`GET /api/heroes` 응답 원소)
```
{
  id: string
  name: string
  role: "tank" | "damage" | "support"
  archetype: string   // 역할 세부 서브타이틀 (예: "정찰 지원", "방벽 수문장")
}
```

### Map (`GET /api/maps` 응답 원소)
```
{
  id: string
  name: string
  mode: string                 // 저장값은 영문 enum. 현재 시드 데이터에는
                                // "control" | "escort" | "hybrid" 3종만 등록돼
                                // 있음 (design.md에 "clash"/"flashpoint"/"push"
                                // 3종 추가 예정이 계획돼 있으나 아직 시드 미반영)
  data_richness: "rich" | "growing"
}
```
`data_richness`는 저장값이 아니라, 해당 맵에 큐레이션된 `map_hero_ratings` 행 수를
`MAP_DATA_RICH_THRESHOLD`(현재 3)와 비교해 요청마다 계산한다.

### Meta (`GET /api/meta` 응답)
```
{
  season: string        // 예: "시즌 4"
  data_version: string   // 예: "v0.3"
}
```
DB 조회 없이 `config.SEED_SEASON`/`config.SEED_DATA_VERSION` 상수를 그대로 반환한다.

### RecommendationRequest (`POST /api/recommendations` 요청 본문)
```
{
  enemy_heroes: string[]   // 상대 팀 픽 영웅 id, 0~5개 (선택)
  our_heroes: string[]     // 우리 팀 픽 영웅 id, 0~4개 (선택)
  empty_position: "tank" | "damage" | "support"   // 필수
  map_id: string                                   // 필수
}
```
오버워치 룰상 "영웅 1인 1팀" 제한은 팀 내부에만 적용되므로, 상대 팀이 이미 픽한
영웅이라도 우리 팀 후보에서 제외되지 않는다(미러 픽 허용). 후보에서 제외되는 건
`our_heroes`에 이미 들어있는 영웅뿐이다.

### RecommendationResponse (`POST /api/recommendations` 응답 본문)
```
{
  recommendations: [
    {
      hero_id: string
      hero_name: string
      role: "tank" | "damage" | "support"
      archetype: string
      total_score: int              // 카운터+시너지+맵 가중합 원점수. 상한 없음
      percentage: int                // 0~100. percentage = clamp(50 + total_score, 0, 100)
      score_breakdown: { counter: int, synergy: int, map: int }
      reasons: string[]              // 추천 근거 (일치하는 관계가 없으면 "일반적으로 무난한 영웅")
      is_must_pick: boolean           // percentage >= 90 (config.MUST_PICK_PERCENTAGE_THRESHOLD)
      notes: string[]                // 패치 트렌드 등 자유 코멘터리 자리 — 아직 큐레이션
                                      // 데이터가 없어 항상 빈 배열
    }
  ]
  notice: string | null   // 상대/우리 팀 픽을 하나도 입력하지 않았을 때 등, 추천 근거가
                          // 맵 점수만으로 제한됨을 알리는 안내 문구
}
```

## 점수 계산 로직 요약

후보 영웅마다 다음 3가지를 합산한다 (`backend/app/scoring.py`, `config.py`):
- **카운터 점수**: 상대 팀 중 카운터하는 영웅 수 × `WEIGHT_COUNTER`(15)
- **시너지 점수**: 우리 팀 중 시너지 좋은 영웅 수 × `WEIGHT_SYNERGY`(10)
- **맵 점수**: 맵 평가 강함 `+15` / 약함 `-15` / 데이터 없음(또는 "보통") `0`

`percentage = clamp(50 + total_score, 0, 100)`로 0~100 표시값 변환.
`percentage >= 90`이면 `is_must_pick = true`.

## 에러 응답 예시

**422** (필수 필드 누락)
```json
{ "detail": [ { "loc": ["body", "empty_position"], "msg": "field required" } ] }
```

**400** (존재하지 않는 영웅/맵 id, 또는 팀 인원 초과)
```json
{ "detail": "알 수 없는 영웅입니다: 존재하지않는영웅" }
```

**502** (예상 못 한 서버 오류)
```json
{ "detail": "일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요." }
```

## 참고 — 설계 문서에는 있으나 아직 구현되지 않은 항목

`design.md`의 "스코어링 개선 검토"/"결측치 3단 상태" 절은 아래 두 가지 변경을
**"결정 완료" 또는 "구현 대기"**로 기록해뒀지만, 이 문서 작성 시점 기준
`backend/app/scoring.py`에는 반영되어 있지 않다. 실제로 구현되면 이 API
명세서도 함께 갱신해야 한다.

1. `percentage` 계산을 현재의 선형 clamp에서 tanh 기반 포화 곡선으로 교체하는 안
2. 결측치를 "미검토/검토완료-중립/검토완료-값있음" 3단으로 구분해 `data_gaps: string[]`
   필드를 응답에 추가하는 안 (`reviewed_neutral_pairs` 테이블 포함)

또한 `icon_url`/`archetype_category` 필드(영웅 초상화·아키타입 그룹핑)는 별도
브랜치(`worktree-ui-hero-images-archetype`)에서 진행 중이며, 이 문서는 `master`
기준이라 포함하지 않았다.
