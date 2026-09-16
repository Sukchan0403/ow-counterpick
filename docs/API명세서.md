# 오버워치 밴프준 보조 서비스 — API 명세서

- 프로젝트: 오버워치 밴프준 보조 웹서비스 (ow-counterpick)
- 저장소: https://github.com/Sukchan0403/ow-counterpick
- 기준: `master` + `worktree-scoring-improvements` 병합 후 구현 (`backend/app/`) —
  설계 문서(`docs/superpowers/specs/2026-09-07-overwatch-hero-recommender-design.md`)의
  "API 명세 (상세)"/"결측치 3단 상태"/"스코어링 개선 검토" 절을 실제 코드·
  테스트(`backend/tests/`)와 대조해 정리. `icon_url`/`archetype_category`
  (`worktree-ui-hero-images-archetype`)와 `data_gaps`/tanh percentage
  (`worktree-scoring-improvements`)를 모두 반영한 통합 버전.
- 베이스 URL(로컬 개발): `http://localhost:8000`

## 엔드포인트 개요

| 메서드 | 경로 | 설명 | 요청 스키마 | 응답 스키마 | 상태 코드 |
|---|---|---|---|---|---|
| GET | `/api/heroes` | 영웅 목록 조회 | `?lang=ko\|en\|ja\|zh-cn\|zh-tw` (선택) | `Hero[]` | 200, 502 |
| GET | `/api/maps` | 맵 목록 조회 | `?lang=ko\|en\|ja\|zh-cn\|zh-tw` (선택) | `Map[]` | 200, 502 |
| GET | `/api/meta` | 시드 데이터 시즌/버전 정보 | - | `Meta` | 200, 502 |
| POST | `/api/recommendations` | 빈 포지션 추천 영웅 순위 조회 | `RecommendationRequest` | `RecommendationResponse` | 200, 400, 422, 502 |

### 다국어(`lang`) 처리

`heroes.name`/`archetype`, `maps.name`, `HeroRecommendation.reasons`/`data_gaps` 등
DB에서 오는 표시용 텍스트는 `lang`에 따라 한국어(`ko`, 기본값)/영어(`en`)/일본어
(`ja`)/중국어 간체(`zh-cn`)/중국어 번체(`zh-tw`) 중 하나로 내려온다. `hero_id`/`map_id`/`role`/`archetype_category`/`mode`
같은 내부 식별자는 언어와 무관하게 항상 동일한 값(프론트가 자체 사전으로 번역)이며,
번역이 비어있는 행은 조용히 한국어로 폴백한다(`backend/app/repository.py`의
`_localized()` 참고). GET 엔드포인트는 쿼리 파라미터로, POST
`/api/recommendations`는 요청 본문의 `lang` 필드로 받는다.

- **422**: `map_id`가 요청 본문에 아예 없을 때 (pydantic 검증 실패). `empty_position`은
  선택 필드라 생략해도 422가 나지 않음.
- **400**: 요청 형식은 맞지만 `enemy_heroes`/`our_heroes`/`map_id`에 존재하지 않는 id가
  섞여 있거나, 팀 인원 제한(상대 5명/우리 4명)을 초과했을 때. `empty_position`을
  생략했는데 `our_heroes`가 정확히 4명이 아니거나, 4명이어도 표준 조합
  (탱커1·딜러2·힐러2)으로 설명 안 되는 구성일 때도 400.
- **502**: 예상 못 한 서버 오류 (`main.py`의 전역 예외 핸들러가 통일 처리)

## 스키마

### Hero (`GET /api/heroes` 응답 원소)
```
{
  id: string
  name: string
  role: "tank" | "damage" | "support"
  archetype: string            // 역할 세부 서브타이틀 (예: "정찰 지원", "방벽 수문장")
  icon_url: string             // 블리자드 CDN 초상화 URL. 없으면 빈 문자열(프론트가 이니셜 폴백 렌더링)
  archetype_category: string   // 그룹 필터링용 상위 분류 (예: "의무관", "개시자")
}
```

### Map (`GET /api/maps` 응답 원소)
```
{
  id: string
  name: string
  mode: string                 // 저장값은 영문 enum: "control" | "escort" | "hybrid" |
                                // "clash" | "push" | "flashpoint" (6종·32개 맵 전부 시드 등록됨,
                                // 2026-09-14 나무위키/OverFast API 기준 확장 — 신규
                                // 추가된 맵들은 아직 map_hero_ratings 큐레이션 전이라
                                // growing 고정)
  image_url: string            // 맵 스크린샷 URL. OverFast API(overfast-api.tekrop.fr)에서
                                // 확보해 시드에 저장. 없으면 빈 문자열(프론트가 단색
                                // 배경으로 폴백).
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
  empty_position?: "tank" | "damage" | "support"   // 선택. 생략하면 아래 자동 판단
  map_id: string                                   // 필수
  lang?: "ko" | "en" | "ja" | "zh-cn" | "zh-tw"                        // 선택. 기본값 "ko" — 응답의 표시용 텍스트 언어
}
```
오버워치 룰상 "영웅 1인 1팀" 제한은 팀 내부에만 적용되므로, 상대 팀이 이미 픽한
영웅이라도 우리 팀 후보에서 제외되지 않는다(미러 픽 허용). 후보에서 제외되는 건
`our_heroes`에 이미 들어있는 영웅뿐이다.

**빈 포지션 자동 판단**: `empty_position`을 생략하면 `our_heroes`가 정확히
4명이어야 하고, `config.TEAM_ROLE_COMPOSITION`(탱커1·딜러2·힐러2) 기준으로
정확히 한 역할만 1명 부족할 때 그 역할을 자동 채택한다
(`backend/app/composition.py`). 4명이 아니거나 구성이 표준으로 설명 안 되면
(정원 초과, 또는 두 역할이 동시에 부족) 400.

### RecommendationResponse (`POST /api/recommendations` 응답 본문)
```
{
  empty_position: "tank" | "damage" | "support"  // 실제로 추천에 쓰인 포지션.
                                                   // 요청에서 생략됐으면 자동 판단된 값
  recommendations: [
    {
      hero_id: string
      hero_name: string
      role: "tank" | "damage" | "support"
      archetype: string
      icon_url: string                // Hero.icon_url과 동일 값
      archetype_category: string      // Hero.archetype_category와 동일 값
      total_score: int              // 카운터+시너지+맵 가중합 원점수. 상한 없음
      percentage: int                // 0~100. percentage = round(PERCENTAGE_BASELINE +
                                      // PERCENTAGE_AMPLITUDE * tanh(total_score / PERCENTAGE_SCALE))
                                      // (하드 clamp에서 tanh 포화 곡선으로 교체 — 하이스코어
                                      // 후보끼리 100%로 뭉개지는 변별력 문제 완화)
      score_breakdown: { counter: int, synergy: int, map: int }
      reasons: string[]              // 추천 근거 (일치하는 관계가 없으면 "일반적으로 무난한 영웅")
      is_must_pick: boolean           // percentage >= 90 (config.MUST_PICK_PERCENTAGE_THRESHOLD)
      notes: string[]                // 패치 트렌드 등 자유 코멘터리 자리 — 아직 큐레이션
                                      // 데이터가 없어 항상 빈 배열
      data_gaps: string[]            // "결측치 3단 상태" — 카운터/시너지 관계가 "미검토"인
                                      // 상대/아군만 여기 담김 (예: "상대 리퍼와의 카운터
                                      // 관계 미검토"). "검토완료-중립"(reviewed_neutral_pairs
                                      // 테이블에 등록됨)은 여기 안 담기고 조용히 0점 처리됨.
                                      // 반대 방향(상대가 후보를 카운터함)으로 검토된 관계도
                                      // "미검토"가 아니다 — score_breakdown.counter가 음수가
                                      // 되고 그 근거가 reasons에 담김(2026-09-15 변경, 아래
                                      // "점수 계산 로직 요약" 참고)
    }
  ]
  notice: string | null   // 상대/우리 팀 픽을 하나도 입력하지 않았을 때 등, 추천 근거가
                          // 맵 점수만으로 제한됨을 알리는 안내 문구
}
```

## 점수 계산 로직 요약

후보 영웅마다 다음 3가지를 합산한다 (`backend/app/scoring.py`, `config.py`):
- **카운터 점수**: 상대 팀 중 카운터하는 영웅 수 × `WEIGHT_COUNTER`(60 — 다른 모든
  보너스의 최댓값 합보다 항상 크게 잡아 하드카운터가 다른 점수에 밀리지 않도록 함)
  **−** 상대 팀 중 오히려 후보를 카운터하는 것으로 알려진 영웅 수 ×
  `WEIGHT_COUNTERED_BY`(= `-WEIGHT_COUNTER`, 2026-09-15 추가 — `counter_relations`는
  방향성이 있어서 "후보가 상대를 카운터함"과 "상대가 후보를 카운터함"이 별개
  행이다. 둘 다 알려져 있으면 순합으로 상쇄될 수 있음)
- **시너지 점수**: 우리 팀 중 시너지 좋은 영웅 수 × `WEIGHT_SYNERGY`(10)
- **맵 점수**: 맵 평가 강함 `+15` / 약함 `-15` / 데이터 없음(또는 "보통") `0`

`percentage = round(PERCENTAGE_BASELINE + PERCENTAGE_AMPLITUDE * tanh(total_score / PERCENTAGE_SCALE))`
(기본값: BASELINE=50, AMPLITUDE=50, SCALE=60)로 0~100 표시값 변환.
`percentage >= 90`이면 `is_must_pick = true`.

### 결측치 3단 상태

"데이터 없는 조합은 중립 점수"만으로는 "아직 검토 안 한 조합"과 "검토했는데
실제로 중립인 조합"을 구분할 수 없다. 그래서 카운터/시너지 관계를 3단으로
명시적으로 구분한다:

| 상태 | 판정 기준 | 응답 반영 |
|---|---|---|
| 미검토 | `counter_relations`/`synergy_relations`에도, `reviewed_neutral_pairs`에도 없음 | `data_gaps`에 노출 |
| 검토완료-중립 | `reviewed_neutral_pairs`에 마커로 등록됨 | 조용히 0점 처리, `data_gaps`에 안 담김 |
| 검토완료-값있음 | `counter_relations`/`synergy_relations`에 실제 행 있음 | 기존처럼 점수+`reasons`에 표시 |

미러 픽(후보가 상대 팀에도 있는 경우)은 자기 자신과의 카운터 관계를 애초에
따지지 않으므로 `data_gaps`에 자기참조 항목이 생기지 않는다.

## 에러 응답 예시

**422** (필수 필드 누락)
```json
{ "detail": [ { "loc": ["body", "map_id"], "msg": "field required" } ] }
```

**400** (존재하지 않는 영웅/맵 id, 또는 팀 인원 초과)
```json
{ "detail": "알 수 없는 영웅입니다: 존재하지않는영웅" }
```

**502** (예상 못 한 서버 오류)
```json
{ "detail": "일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요." }
```

## 참고 — 아직 남은 갭

- 전체 영웅 54종(2026-09-15 기준) 전원이 카운터/시너지 관계를 최소 1건 이상
  갖고 있다 — 초기엔 15종에만 데이터가 있었지만 이후 여러 차례 큐레이션을
  거치며 채워졌다. 다만 밀도는 영웅마다 다르다(D.Va처럼 전체 로스터·전체
  맵을 상대로 촘촘히 채운 경우도 있고, 최신 영웅은 2~4건 정도로 얕은 경우도
  있음) — 여전히 데이터에 없는 조합은 `data_gaps`에 "미검토"로 정상 노출된다
  (결측치 3단 상태 참고).
- 6개 모드 32개 맵 중 31개가 `map_hero_ratings`를 최소 1건 이상 갖고 있다
  (`hanaoka`만 예외 — 신작이라 확신 있는 지형 정보가 없어 의도적으로 비워둠).
  다만 맵당 평가 밀도도 영웅마다 편차가 크다.
- `neon_junction`(혼합)은 OverFast API 스크린샷이 계속 404라서(신규 맵이라
  아직 캐싱이 안 된 것으로 추정), 사용자가 직접 캡처한 스크린샷을 받아
  `frontend/public/maps/neon_junction.png`로 넣고 `image_url`을 상대 경로
  (`/maps/neon_junction.png`)로 지정했다. 다른 31개 맵은 전부 외부 CDN
  (OverFast API) 핫링크인데 이 맵만 예외적으로 로컬 정적 파일이다.
- `doctrine`(지원, 2026-09-15 추가)은 정식 출시(2026-10-06) 전 사전체험
  단계라 OverFast API에 아직 없다 — `icon_url`이 다른 영웅들처럼 Blizzard
  CDN(`d15f34w2p8l1cc.cloudfront.net`)이 아니라 나무위키 이미지 CDN
  (`i.namu.wiki`) 링크다. 정식 출시 후 OverFast에 등록되면 다른 영웅들과
  같은 CDN으로 맞춰도 됨. 맵 평가 데이터는 아직 없음(실전 포지셔닝 감각이
  필요해 2일 된 영웅에 대해 판단하기 이름).
- `MUST_PICK_PERCENTAGE_THRESHOLD`(90)는 아직 실제 시드 데이터 기준 실증
  검증 전이다 — `backend/scripts/audit_must_pick_distribution.py`로 분포를
  확인한 뒤 조정 여부를 판단해야 한다.
