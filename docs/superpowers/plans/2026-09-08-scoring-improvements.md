# 스코어링 개선 (결측치 3단 상태 / 하드카운터 가중치 / percentage 포화 곡선) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스펙의 "스코어링 개선 검토 (2026-09-08)" 섹션에 정리된 우선순위 1~4번을
실제 코드(백엔드 `scoring.py`/`repository.py`/`models.py`/`config.py`, 프론트
`ResultsPanel.tsx`)에 반영한다.

**Architecture:** 기존 3테이블(counter_relations/synergy_relations/map_hero_ratings)
구조는 그대로 두고, 결측치 구분을 위한 마커 테이블 `reviewed_neutral_pairs`를
추가한다. 점수 계산은 여전히 DB에 의존하지 않는 순수 함수(`scoring.py`)로 유지하고,
DB 조회(`repository.py`)와 API 계층(`routers/recommendations.py`)에서 그 순수
함수에 필요한 데이터를 채워 넣는 기존 패턴을 그대로 따른다.

**Tech Stack:** Python 3.10 / FastAPI / SQLite (백엔드), TypeScript / Next.js (프론트,
이 작업 범위에서는 UI 텍스트/데이터 배선만 변경 — 프론트에 자동 테스트 인프라가
없어 이 플랜에서도 새로 만들지 않고 기존 관례(수동 검증)를 따름)

**Spec:** `docs/superpowers/specs/2026-09-07-overwatch-hero-recommender-design.md`
(특히 "결측치 3단 상태", "점수 계산 로직"의 "가중치 튜닝 제약", "스코어링 개선
검토 (2026-09-08)" 섹션)

## Global Constraints

- 결측치 3단 상태: 미검토(`data_gaps`에 노출) / 검토완료-중립(조용히 0점) /
  검토완료-값있음(기존처럼 점수+근거). `reviewed_neutral_pairs(hero_id,
  other_hero_id, relation_type)` 테이블로 "검토완료-중립"을 표시한다.
- 하드카운터 가중치 불변식: `WEIGHT_COUNTER` 1건 값 > (시너지 최대 4명 ×
  `WEIGHT_SYNERGY`) + `WEIGHT_MAP_STRONG`. 현재 값 기준: 60 > 4×10+15(=55).
- `percentage = round(50 + 50 * tanh(total_score / PERCENTAGE_SCALE))` — 하드
  clamp 대신 완만한 포화 곡선. `PERCENTAGE_BASELINE`(50)은 이 공식의 절반
  지점으로 고정된 상수라 바꾸지 않는다.
- 프론트 표시 문구: API 필드명 `percentage`는 유지하되, 화면 텍스트는
  "OO%"가 아니라 "추천 지수 OO"로 표시한다 (실제 승률로 오해 방지).
- `scoring.py`는 DB에 의존하지 않는 순수 함수로 유지한다 — 새 파라미터도
  전부 이미 조회된 dict/list를 인자로 받는다.
- `models.py`/API 스키마를 고치면 스펙 문서의 "API 명세" 표도 같이 갱신하는
  게 이 코드베이스의 기존 관례이지만(`models.py` 상단 docstring 참고), 이번
  플랜에서 다루는 필드(`data_gaps`)는 이미 스펙에 반영돼 있으므로(직전 대화에서
  추가) 스펙 문서 추가 수정은 필요 없다.

---

## Task 1: `scoring.py` — 결측치 3단 상태(`data_gaps`) 순수 로직

**Files:**
- Modify: `backend/app/scoring.py`
- Test: `backend/tests/test_scoring.py`

**Interfaces:**
- Consumes: 없음 (순수 함수 내부 확장)
- Produces: `ScoredHero.data_gaps: list[str]` / `score_candidates(...)`에 키워드 전용
  파라미터 `enemy_ids`, `ally_ids`, `reviewed_neutral_counter_pairs`,
  `reviewed_neutral_synergy_pairs`, `id_to_name` 추가 (전부 기본값 `None`,
  기존 호출부는 그대로 동작) — Task 4의 라우터가 이 파라미터들을 실제로 채워서 호출

- [ ] **Step 1: 실패하는 테스트 작성 — `backend/tests/test_scoring.py`에 추가**

```python
def test_data_gaps_flags_unreviewed_enemy_counter_relation():
    candidates = make_candidates()
    result = score_candidates(
        candidates, [], [], [],
        enemy_ids=["widowmaker"],
        id_to_name={"widowmaker": "위도우메이커"},
    )
    by_id = {s.hero_id: s for s in result}
    assert by_id["kiriko"].data_gaps == ["상대 위도우메이커와의 카운터 관계 미검토"]


def test_data_gaps_silent_when_pair_is_reviewed_neutral():
    candidates = make_candidates()
    result = score_candidates(
        candidates, [], [], [],
        enemy_ids=["widowmaker"],
        reviewed_neutral_counter_pairs=[{"hero_id": "kiriko", "other_hero_id": "widowmaker"}],
        id_to_name={"widowmaker": "위도우메이커"},
    )
    by_id = {s.hero_id: s for s in result}
    assert by_id["kiriko"].data_gaps == []
    assert by_id["kiriko"].counter_score == 0


def test_data_gaps_skips_enemy_already_matched_by_actual_counter_row():
    candidates = make_candidates()
    counter_rows = [{"hero_id": "kiriko", "countered_hero_id": "widowmaker", "reason": "스즈 무효화"}]
    result = score_candidates(
        candidates, counter_rows, [], [],
        enemy_ids=["widowmaker"],
        id_to_name={"widowmaker": "위도우메이커"},
    )
    by_id = {s.hero_id: s for s in result}
    assert by_id["kiriko"].data_gaps == []


def test_data_gaps_flags_unreviewed_ally_synergy_relation():
    candidates = make_candidates()
    result = score_candidates(
        candidates, [], [], [],
        ally_ids=["tracer"],
        id_to_name={"tracer": "트레이서"},
    )
    by_id = {s.hero_id: s for s in result}
    assert by_id["kiriko"].data_gaps == ["아군 트레이서와의 시너지 관계 미검토"]


def test_data_gaps_synergy_silent_when_reviewed_neutral_either_direction():
    candidates = make_candidates()
    result = score_candidates(
        candidates, [], [], [],
        ally_ids=["tracer"],
        reviewed_neutral_synergy_pairs=[{"hero_id": "tracer", "other_hero_id": "kiriko"}],
        id_to_name={"tracer": "트레이서"},
    )
    by_id = {s.hero_id: s for s in result}
    assert by_id["kiriko"].data_gaps == []


def test_data_gaps_empty_by_default_when_no_enemy_or_ally_ids_given():
    candidates = make_candidates()
    result = score_candidates(candidates, [], [], [])
    for s in result:
        assert s.data_gaps == []
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run (`backend/` 디렉토리, 가상환경 활성화 상태에서):
`pytest tests/test_scoring.py -v -k data_gaps`
Expected: FAIL (`score_candidates() got an unexpected keyword argument 'enemy_ids'` 등)

- [ ] **Step 3: `backend/app/scoring.py`의 `ScoredHero`에 `data_gaps` 필드 추가**

`notes: list[str] = field(default_factory=list)` 줄 바로 아래에 추가:

```python
    data_gaps: list[str] = field(default_factory=list)
    # "결측치 3단 상태": 미검토 상태인 카운터/시너지 관계만 여기 담긴다.
    # 검토완료-중립(reviewed_neutral_pairs에 등록됨)은 조용히 0점 처리되고
    # 여기 안 담긴다 — 스펙의 "결측치 3단 상태" 절 참고.
```

- [ ] **Step 4: `score_candidates` 시그니처에 키워드 전용 파라미터 추가**

```python
def score_candidates(
    candidates: list[dict],
    counter_rows: list[dict],
    synergy_rows: list[dict],
    map_rows: list[dict],
    *,
    enemy_ids: list[str] | None = None,
    ally_ids: list[str] | None = None,
    reviewed_neutral_counter_pairs: list[dict] | None = None,
    reviewed_neutral_synergy_pairs: list[dict] | None = None,
    id_to_name: dict[str, str] | None = None,
) -> list[ScoredHero]:
```

- [ ] **Step 5: 함수 본문 맨 앞부분(기존 `counter_by_hero: dict[...] = {}` 줄 바로 위)에
      기본값 정규화 + 검토완료-중립 lookup set 구성 추가**

```python
    enemy_ids = enemy_ids or []
    ally_ids = ally_ids or []
    reviewed_neutral_counter_pairs = reviewed_neutral_counter_pairs or []
    reviewed_neutral_synergy_pairs = reviewed_neutral_synergy_pairs or []
    id_to_name = id_to_name or {}

    neutral_counter_set = {
        (row["hero_id"], row["other_hero_id"]) for row in reviewed_neutral_counter_pairs
    }
    neutral_synergy_set: set[tuple[str, str]] = set()
    for row in reviewed_neutral_synergy_pairs:
        neutral_synergy_set.add((row["hero_id"], row["other_hero_id"]))
        neutral_synergy_set.add((row["other_hero_id"], row["hero_id"]))

```

- [ ] **Step 6: 카운터 루프 뒤에 미검토 상대 판정 추가**

기존 코드:
```python
        for row in counter_by_hero.get(cid, []):
            scored.counter_score += WEIGHT_COUNTER
            scored.reasons.append(row["reason"])
```
바로 아래에 추가:
```python
        countered_enemy_ids = {row["countered_hero_id"] for row in counter_by_hero.get(cid, [])}
        for enemy_id in enemy_ids:
            if enemy_id in countered_enemy_ids:
                continue
            if (cid, enemy_id) in neutral_counter_set:
                continue
            enemy_name = id_to_name.get(enemy_id, enemy_id)
            scored.data_gaps.append(f"상대 {enemy_name}와의 카운터 관계 미검토")
```

- [ ] **Step 7: 시너지 루프(`seen_partners` 사용하는 for문) 뒤에 미검토 아군 판정 추가**

기존 시너지 for문이 끝난 직후(맵 처리 코드 시작 전) 추가:
```python
        for ally_id in ally_ids:
            if ally_id in seen_partners:
                continue
            if (cid, ally_id) in neutral_synergy_set:
                continue
            ally_name = id_to_name.get(ally_id, ally_id)
            scored.data_gaps.append(f"아군 {ally_name}와의 시너지 관계 미검토")
```

- [ ] **Step 8: 테스트 실행 → 통과 확인**

Run: `pytest tests/test_scoring.py -v`
Expected: 기존 6개 + 신규 6개 전부 PASS (기존 테스트는 새 파라미터를 안 넘기므로
`enemy_ids`/`ally_ids`가 빈 리스트로 처리돼 동작 그대로 유지됨)

- [ ] **Step 9: Commit**

```bash
git add backend/app/scoring.py backend/tests/test_scoring.py
git commit -m "feat: add data_gaps tracking for unreviewed counter/synergy pairs"
```

---

## Task 2: 하드카운터 가중치 재조정 + `percentage` 포화 곡선 교체

**Files:**
- Modify: `backend/app/config.py`
- Modify: `backend/app/scoring.py`
- Modify: `backend/tests/test_scoring.py`
- Modify: `backend/tests/test_api.py`
- Modify: `backend/README.md`

**Interfaces:**
- Consumes: 없음
- Produces: `config.WEIGHT_COUNTER`(60), `config.PERCENTAGE_SCALE`(60) — Task 4/6가 참고

- [ ] **Step 1: 실패하는 테스트로 먼저 기대값 갱신 — `backend/tests/test_scoring.py`**

파일 상단 import 줄을 아래로 교체:
```python
import math

from app.config import PERCENTAGE_SCALE, WEIGHT_COUNTER, WEIGHT_MAP_STRONG, WEIGHT_SYNERGY
from app.scoring import NEUTRAL_REASON, score_candidates
```

`test_counter_score_applies_only_to_matching_candidate`의 아래 줄을:
```python
    assert by_id["kiriko"].counter_score == 15
```
다음으로 교체:
```python
    assert by_id["kiriko"].counter_score == WEIGHT_COUNTER
```

`test_total_score_sums_all_three_components_and_sorts_descending`의 아래 두 줄을:
```python
    assert result[0].total_score == 15 + 10 + 15
    assert result[0].percentage == 90  # 50 + 40
```
다음으로 교체:
```python
    expected_total = WEIGHT_COUNTER + WEIGHT_SYNERGY + WEIGHT_MAP_STRONG
    assert result[0].total_score == expected_total
    assert result[0].percentage == round(50 + 50 * math.tanh(expected_total / PERCENTAGE_SCALE))
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `pytest tests/test_scoring.py -v`
Expected: FAIL (`ImportError: cannot import name 'PERCENTAGE_SCALE'` — 아직 config에
없음. `counter_score == WEIGHT_COUNTER`도 현재 값(15)과 새 기대 관계상 아직은
우연히 통과할 수 있으니 이 스텝의 핵심 실패 원인은 import 에러임)

- [ ] **Step 3: `backend/app/config.py`의 가중치 상수 블록 교체**

기존:
```python
WEIGHT_COUNTER = 15  # 카운터하는 상대 영웅 1명당
WEIGHT_SYNERGY = 10  # 시너지 좋은 아군 영웅 1명당
WEIGHT_MAP_STRONG = 15  # 맵 평가 "강함"
WEIGHT_MAP_WEAK = -15  # 맵 평가 "약함"
# 맵 평가 데이터가 없거나 "보통"이면 0 (중립) — 스펙의 에러 처리 표 참고

# 총점(raw score, 이론상 상한 없음)을 0~100% 표시용 점수로 바꿀 때 쓰는 기준선.
# percentage = clamp(50 + raw_score, 0, 100)
PERCENTAGE_BASELINE = 50
```
다음으로 교체:
```python
# 하드카운터 가중치 불변식(스펙 "점수 계산 로직"의 "가중치 튜닝 제약" 참고):
# WEIGHT_COUNTER 1건 값은 다른 모든 보너스의 최댓값 합(시너지 최대 4명 ×
# WEIGHT_SYNERGY + WEIGHT_MAP_STRONG)보다 항상 커야 한다. 지금 값 기준
# 4*10+15=55이므로 60으로 설정 — 이 상수들을 조정할 때마다 이 부등식을 다시 확인할 것.
WEIGHT_COUNTER = 60  # 카운터하는 상대 영웅 1명당
WEIGHT_SYNERGY = 10  # 시너지 좋은 아군 영웅 1명당
WEIGHT_MAP_STRONG = 15  # 맵 평가 "강함"
WEIGHT_MAP_WEAK = -15  # 맵 평가 "약함"
# 맵 평가 데이터가 없거나 "보통"이면 0 (중립) — 스펙의 에러 처리 표 참고

# 총점(raw score, 이론상 상한 없음)을 0~100 표시용 점수로 바꿀 때 쓰는 기준선.
# percentage = round(PERCENTAGE_BASELINE + 50 * tanh(raw_score / PERCENTAGE_SCALE))
# 50이 공식의 절반 지점 상수라 PERCENTAGE_SCALE만 튜닝 대상이고 이 값 자체는
# 바꾸지 않는다.
PERCENTAGE_BASELINE = 50

# tanh 포화 곡선의 스케일 상수. 하드 clamp(50+raw_score, 0, 100)는 점수가 높은
# 후보끼리 100%로 뭉개져 변별력이 사라지는 문제가 있어 교체했다. WEIGHT_COUNTER와
# 같은 값으로 잡아, 카운터 1건만 있어도 강하게(약 88%) 오르되 100%로 즉시
# 포화되지는 않도록 함.
PERCENTAGE_SCALE = 60
```

- [ ] **Step 4: `backend/app/scoring.py`의 `percentage` 프로퍼티 교체**

파일 상단 import 블록을:
```python
from app.config import (
    MUST_PICK_PERCENTAGE_THRESHOLD,
    PERCENTAGE_BASELINE,
    WEIGHT_COUNTER,
    WEIGHT_MAP_STRONG,
    WEIGHT_MAP_WEAK,
    WEIGHT_SYNERGY,
)
```
다음으로 교체:
```python
import math

from app.config import (
    MUST_PICK_PERCENTAGE_THRESHOLD,
    PERCENTAGE_BASELINE,
    PERCENTAGE_SCALE,
    WEIGHT_COUNTER,
    WEIGHT_MAP_STRONG,
    WEIGHT_MAP_WEAK,
    WEIGHT_SYNERGY,
)
```

`percentage` 프로퍼티를:
```python
    @property
    def percentage(self) -> int:
        pct = PERCENTAGE_BASELINE + self.total_score
        return max(0, min(100, pct))
```
다음으로 교체:
```python
    @property
    def percentage(self) -> int:
        return round(PERCENTAGE_BASELINE + 50 * math.tanh(self.total_score / PERCENTAGE_SCALE))
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `pytest tests/test_scoring.py -v`
Expected: PASS

- [ ] **Step 6: `backend/tests/test_api.py`의 가중치 의존 기대값 갱신**

`test_recommendations_normal_case`의 주석+단언문을:
```python
    # 키리코: 위도우메이커 카운터(15) + 겐지랑 시너지 없음(0) + 맵 데이터 없음(0) = 15
    # 모이라: 카운터 없음(0) + 시너지 없음(0) + 맵 강함(15) = 15
    # 둘 다 15점 동점 -> 이름 알파벳/가나다 순 정렬(모이라가 키리코보다 앞? 정렬은 문자열 비교)
    scores = {r["hero_id"]: r["total_score"] for r in body["recommendations"]}
    assert scores["kiriko"] == 15
    assert scores["moira"] == 15
    assert scores["lucio"] == 10  # 겐지와 시너지만
```
다음으로 교체:
```python
    # 키리코: 위도우메이커 카운터(60, WEIGHT_COUNTER 상향 후) + 겐지랑 시너지 없음(0)
    #         + 맵 데이터 없음(0) = 60
    # 모이라: 카운터 없음(0) + 시너지 없음(0) + 맵 강함(15) = 15
    # 루시우: 카운터 없음(0) + 겐지와 시너지(10) + 맵 데이터 없음(0) = 10
    scores = {r["hero_id"]: r["total_score"] for r in body["recommendations"]}
    assert scores["kiriko"] == 60
    assert scores["moira"] == 15
    assert scores["lucio"] == 10  # 겐지와 시너지만
```

`test_is_must_pick_when_percentage_reaches_threshold`의 아래 줄을:
```python
    assert reinhardt_row["percentage"] == 90
    assert reinhardt_row["is_must_pick"] is True
```
다음으로 교체:
```python
    assert reinhardt_row["is_must_pick"] is True
    # tanh 포화 곡선 — 카운터+시너지+맵강함이 겹친 강한 조합이지만 100%로
    # 완전히 포화되지는 않는다 (변별력 유지가 이 교체의 목적).
    assert 90 <= reinhardt_row["percentage"] < 100
```

- [ ] **Step 7: 테스트 실행 → 통과 확인**

Run: `pytest -v`
Expected: 전체 PASS

- [ ] **Step 8: `backend/README.md`의 "점수 계산" 섹션 갱신**

```
- 카운터: 상대 팀 중 이 영웅이 카운터하는 영웅 1명당 +15
- 시너지: 우리 팀 중 이 영웅과 시너지 좋은 영웅 1명당 +10
- 맵: 강함 +15 / 약함 -15 / 데이터 없음(보통 포함) 0

`percentage = clamp(50 + total_score, 0, 100)` — 목업에서 쓰던 "%" 표시용 값이고,
실제 순위/필터링은 `total_score`(raw) 기준.
```
다음으로 교체:
```
- 카운터: 상대 팀 중 이 영웅이 카운터하는 영웅 1명당 +60 (다른 모든 보너스의
  합보다 항상 크게 잡아, 하드카운터가 자잘한 시너지/맵 보너스에 묻히지 않도록 함)
- 시너지: 우리 팀 중 이 영웅과 시너지 좋은 영웅 1명당 +10
- 맵: 강함 +15 / 약함 -15 / 데이터 없음(보통 포함) 0

`percentage = round(50 + 50 * tanh(total_score / 60))` — tanh 기반 완만한 포화
곡선(하드 clamp 대체, 점수 높은 후보끼리 100%로 뭉개지는 변별력 손실 완화).
화면 표시는 "OO%"가 아니라 "추천 지수 OO"(퍼센트 기호 제거, 실제 승률로 오해
방지). 실제 순위/필터링은 여전히 `total_score`(raw) 기준.
```

- [ ] **Step 9: Commit**

```bash
git add backend/app/config.py backend/app/scoring.py backend/tests/test_scoring.py backend/tests/test_api.py backend/README.md
git commit -m "fix: rebalance counter weight and replace percentage hard clamp with tanh curve"
```

---

## Task 3: `reviewed_neutral_pairs` 테이블 + repository 조회 함수

**Files:**
- Modify: `seed-data/seed_db.py`
- Create: `seed-data/reviewed_neutral_pairs.json`
- Modify: `backend/tests/conftest.py`
- Modify: `backend/app/repository.py`
- Create: `backend/tests/test_repository.py`

**Interfaces:**
- Consumes: 없음
- Produces: `fetch_heroes_by_ids(conn, hero_ids) -> list[Row]`,
  `fetch_reviewed_neutral_pairs(conn, candidate_ids, other_ids, relation_type) -> list[Row]`
  (`relation_type`은 `"counter"` 또는 `"synergy"`) — Task 4의 라우터가 사용

- [ ] **Step 1: `seed-data/seed_db.py`의 `SCHEMA`에 테이블 추가**

`SCHEMA` 문자열은 `map_hero_ratings` 테이블의 닫는 `);` 바로 다음 줄의 `"""`로
끝난다 (그 `"""`가 `SCHEMA` 변수 할당의 끝). 새 테이블은 **그 `"""` 앞에**,
즉 `map_hero_ratings`의 `);` 바로 아래에 추가한다 (뒤에 넣으면 `SCHEMA` 문자열
밖으로 나가 문법 오류가 남):
```sql

CREATE TABLE IF NOT EXISTS reviewed_neutral_pairs (
    hero_id TEXT NOT NULL REFERENCES heroes(id),
    other_hero_id TEXT NOT NULL REFERENCES heroes(id),
    relation_type TEXT NOT NULL CHECK (relation_type IN ('counter', 'synergy')),
    PRIMARY KEY (hero_id, other_hero_id, relation_type)
);
```

- [ ] **Step 2: `seed-data/reviewed_neutral_pairs.json` 생성 (빈 배열로 시작)**

```json
[]
```

실제 "검토완료-중립" 콘텐츠 큐레이션은 이 플랜 범위 밖(별도 콘텐츠 작업) —
여기서는 스키마/로더/조회 함수만 준비한다.

- [ ] **Step 3: `seed-data/seed_db.py`의 `main()`에 로딩·삽입·집계·무결성 체크 추가**

`map_ratings = load("map_hero_ratings.json")` 줄 바로 아래에 추가:
```python
    reviewed_neutral = load("reviewed_neutral_pairs.json")
```

`conn.executemany(...map_hero_ratings...)` 블록 바로 아래에 추가:
```python
    conn.executemany(
        """INSERT OR REPLACE INTO reviewed_neutral_pairs
           (hero_id, other_hero_id, relation_type)
           VALUES (:hero_id, :other_hero_id, :relation_type)""",
        reviewed_neutral,
    )
```

`print(f"  map_hero_ratings: {len(map_ratings)}")` 바로 아래에 추가:
```python
    print(f"  reviewed_neutral_pairs: {len(reviewed_neutral)}")
```

무결성 체크의 `for r in map_ratings:` 블록 바로 아래에 추가:
```python
    for n in reviewed_neutral:
        if n["hero_id"] not in hero_ids or n["other_hero_id"] not in hero_ids:
            problems.append(("reviewed_neutral_pairs", n))
```

- [ ] **Step 4: 시드 스크립트 실행해서 정상 동작 확인**

Run (`seed-data/` 디렉토리에서): `python3 seed_db.py /tmp/ow_scoring_plan_check.db`
Expected: `reviewed_neutral_pairs: 0` 출력 + "무결성 체크 통과" 메시지, 에러 없음

- [ ] **Step 5: `backend/tests/conftest.py`의 `_SCHEMA`에 테이블 추가**

`_SCHEMA` 문자열은 `map_hero_ratings` 테이블 정의의 닫는 `);` 바로 다음 줄에서
`"""`로 끝난다 (그 닫는 `"""` 자체가 `_SCHEMA` 변수 할당의 끝). 새 테이블은
**그 `"""` 앞에**, 즉 `map_hero_ratings`의 `);` 바로 아래에 추가해야 한다
(뒤에 넣으면 `_SCHEMA` 문자열 밖으로 나가 문법 오류가 남):
```sql
CREATE TABLE reviewed_neutral_pairs (
    hero_id TEXT NOT NULL REFERENCES heroes(id),
    other_hero_id TEXT NOT NULL REFERENCES heroes(id),
    relation_type TEXT NOT NULL CHECK (relation_type IN ('counter','synergy')),
    PRIMARY KEY (hero_id, other_hero_id, relation_type)
);
```

- [ ] **Step 6: `conftest.py`에 검토완료-중립 시드 데이터 + `conn` fixture 추가**

`map_hero_ratings` INSERT 블록(`_conn.executemany(..."INSERT INTO map_hero_ratings"...)`)
바로 아래에 추가:
```python
_conn.executemany(
    "INSERT INTO reviewed_neutral_pairs VALUES (?, ?, ?)",
    [
        # Task 4의 API 테스트에서 "검토완료-중립"(data_gap 없음)을 확인하는 데 사용
        ("lucio", "widowmaker", "counter"),
        ("kiriko", "moira", "synergy"),
    ],
)
```

파일 맨 아래(`client` fixture) 바로 아래에 추가:
```python


@pytest.fixture()
def conn():
    connection = sqlite3.connect(str(_TEST_DB_PATH))
    connection.row_factory = sqlite3.Row
    try:
        yield connection
    finally:
        connection.close()
```

- [ ] **Step 7: 실패하는 테스트 작성 — `backend/tests/test_repository.py`**

```python
"""repository.py의 결측치 3단 상태 지원 조회 함수 유닛 테스트."""
from app.repository import fetch_heroes_by_ids, fetch_reviewed_neutral_pairs


def test_fetch_heroes_by_ids_returns_matching_rows(conn):
    rows = fetch_heroes_by_ids(conn, ["kiriko", "widowmaker"])
    names = {r["id"]: r["name"] for r in rows}
    assert names == {"kiriko": "키리코", "widowmaker": "위도우메이커"}


def test_fetch_heroes_by_ids_empty_list_returns_empty(conn):
    assert fetch_heroes_by_ids(conn, []) == []


def test_fetch_reviewed_neutral_pairs_counter_is_directional(conn):
    rows = fetch_reviewed_neutral_pairs(conn, ["lucio"], ["widowmaker"], "counter")
    assert len(rows) == 1
    assert rows[0]["hero_id"] == "lucio"
    assert rows[0]["other_hero_id"] == "widowmaker"

    # 카운터는 방향성이 있으므로 후보/상대를 뒤바꿔 조회하면 안 잡혀야 함
    reversed_rows = fetch_reviewed_neutral_pairs(conn, ["widowmaker"], ["lucio"], "counter")
    assert reversed_rows == []


def test_fetch_reviewed_neutral_pairs_synergy_matches_either_direction(conn):
    rows_forward = fetch_reviewed_neutral_pairs(conn, ["kiriko"], ["moira"], "synergy")
    assert len(rows_forward) == 1

    # 시너지는 대칭 관계이므로 candidate/other 인자를 뒤바꿔도 잡혀야 함
    rows_reversed_args = fetch_reviewed_neutral_pairs(conn, ["moira"], ["kiriko"], "synergy")
    assert len(rows_reversed_args) == 1
```

- [ ] **Step 8: 테스트 실행 → 실패 확인**

Run: `pytest tests/test_repository.py -v`
Expected: FAIL (`ImportError: cannot import name 'fetch_heroes_by_ids'` 등)

- [ ] **Step 9: `backend/app/repository.py`에 두 함수 추가 (파일 맨 아래)**

```python


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
    """"검토완료-중립" 마커 조회 (결측치 3단 상태). relation_type='counter'는
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
```

- [ ] **Step 10: 테스트 실행 → 통과 확인**

Run: `pytest tests/test_repository.py -v`
Expected: PASS

- [ ] **Step 11: 전체 백엔드 테스트 실행 (회귀 확인)**

Run: `pytest -v`
Expected: 전체 PASS

- [ ] **Step 12: Commit**

```bash
git add seed-data/seed_db.py seed-data/reviewed_neutral_pairs.json backend/tests/conftest.py backend/app/repository.py backend/tests/test_repository.py
git commit -m "feat: add reviewed_neutral_pairs table and repository lookup functions"
```

---

## Task 4: `/api/recommendations`에 `data_gaps` 반영

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/routers/recommendations.py`
- Modify: `backend/tests/test_api.py`

**Interfaces:**
- Consumes: `fetch_heroes_by_ids`, `fetch_reviewed_neutral_pairs` (Task 3) /
  `score_candidates(..., enemy_ids=, ally_ids=, reviewed_neutral_counter_pairs=,
  reviewed_neutral_synergy_pairs=, id_to_name=)` (Task 1)
- Produces: `HeroRecommendation.data_gaps: list[str]` — Task 5의 프론트가 사용

- [ ] **Step 1: 실패하는 테스트 작성 — `backend/tests/test_api.py`에 추가**

```python
def test_recommendations_data_gaps_distinguish_reviewed_neutral_from_unreviewed(client):
    """상대 위도우메이커 기준: 키리코=실제 카운터(값있음, data_gap 없음),
    루시우=검토완료-중립(conftest 시드, data_gap 없음), 모이라/아나=미검토(data_gap 있음)."""
    res = client.post(
        "/api/recommendations",
        json={
            "enemy_heroes": ["widowmaker"],
            "our_heroes": [],
            "empty_position": "support",
            "map_id": "eichenwalde",
        },
    )
    assert res.status_code == 200
    rows = {r["hero_id"]: r for r in res.json()["recommendations"]}

    assert rows["kiriko"]["data_gaps"] == []
    assert rows["lucio"]["data_gaps"] == []
    assert rows["moira"]["data_gaps"] == ["상대 위도우메이커와의 카운터 관계 미검토"]
    assert rows["ana"]["data_gaps"] == ["상대 위도우메이커와의 카운터 관계 미검토"]


def test_recommendations_data_gaps_for_unreviewed_synergy(client):
    """아군 겐지와의 시너지 관계가 검토완료-중립으로도 실제 관계로도 등록 안 된
    후보는 data_gap이 붙어야 한다."""
    res = client.post(
        "/api/recommendations",
        json={
            "enemy_heroes": [],
            "our_heroes": ["genji"],
            "empty_position": "support",
            "map_id": "eichenwalde",
        },
    )
    assert res.status_code == 200
    rows = {r["hero_id"]: r for r in res.json()["recommendations"]}

    assert rows["lucio"]["data_gaps"] == []  # conftest 시드: genji-lucio 시너지 실제 존재
    assert rows["moira"]["data_gaps"] == ["아군 겐지와의 시너지 관계 미검토"]
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `pytest tests/test_api.py -v -k data_gaps`
Expected: FAIL (`KeyError: 'data_gaps'` — 응답에 아직 이 필드 없음)

- [ ] **Step 3: `backend/app/models.py`의 `HeroRecommendation`에 필드 추가**

`notes: list[str] = Field(...)` 블록 바로 아래에 추가:
```python
    data_gaps: list[str] = Field(
        default_factory=list,
        description=(
            "결측치 3단 상태 중 '미검토' 항목만 담긴다 (예: '상대 리퍼와의 카운터 "
            "관계 미검토'). '검토완료-중립'은 조용히 0점 처리되고 여기 안 담긴다."
        ),
    )
```

- [ ] **Step 4: `backend/app/routers/recommendations.py` 수정**

import 블록을:
```python
from app.repository import (
    fetch_counter_relations_for_candidates,
    fetch_heroes_by_role,
    fetch_map_ratings_for_candidates,
    fetch_synergy_relations_for_candidates,
    hero_exists,
    map_exists,
)
```
다음으로 교체:
```python
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
```

`map_rows = [...]` 블록(`with db_session() as conn:` 안, DB 조회 마지막 부분)
바로 아래에 추가:
```python
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
```

`scored = score_candidates(candidates, counter_rows, synergy_rows, map_rows)` 줄을:
```python
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
```
로 교체.

`HeroRecommendation(...)` 생성 블록의 `notes=s.notes,` 줄 바로 아래에 추가:
```python
            data_gaps=s.data_gaps,
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `pytest tests/test_api.py -v`
Expected: 전체 PASS

- [ ] **Step 6: 전체 백엔드 테스트 실행 (회귀 확인)**

Run: `pytest -v`
Expected: 전체 PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/models.py backend/app/routers/recommendations.py backend/tests/test_api.py
git commit -m "feat: surface data_gaps through POST /api/recommendations"
```

---

## Task 5: 프론트엔드 — `percentage` 라벨 변경 + `data_gaps` 배지

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/components/ResultsPanel.tsx`
- Modify: `frontend/src/components/ResultsPanel.module.css`

**Interfaces:**
- Consumes: 백엔드 `HeroRecommendation.data_gaps` (Task 4)
- Produces: 없음 (화면단 최종 소비)

**참고:** 이 프로젝트의 프론트엔드에는 자동 테스트 인프라(Jest 등)가 아직 없다
(기존 관례 — `package.json`에 `test` 스크립트 없음). 이 태스크만을 위해 새로
테스트 러너를 도입하는 건 이번 변경 규모(텍스트 라벨 1곳 + 배지 렌더링 1곳) 대비
과함 — 기존 관례를 따라 수동 검증으로 진행한다.

- [ ] **Step 1: `frontend/src/lib/types.ts`의 `HeroRecommendation`에 필드 추가**

```typescript
export interface HeroRecommendation {
  hero_id: string;
  hero_name: string;
  role: Role;
  archetype: string;
  total_score: number;
  percentage: number;
  score_breakdown: ScoreBreakdown;
  reasons: string[];
  is_must_pick: boolean;
  notes: string[];
  data_gaps: string[];
}
```

- [ ] **Step 2: `frontend/src/components/ResultsPanel.tsx`의 percentage 표시 텍스트 변경**

```tsx
<span className={styles.percentage}>{rec.percentage}%</span>
```
을
```tsx
<span className={styles.percentage}>추천 지수 {rec.percentage}</span>
```
로 교체.

- [ ] **Step 3: `data_gaps` 렌더링 추가**

`notes.map(...)` 블록 바로 아래에 추가:
```tsx
                {rec.data_gaps.map((gap, idx) => (
                  <span key={`gap-${idx}`} className={styles.dataGapTag}>
                    데이터 없음 · {gap}
                  </span>
                ))}
```

- [ ] **Step 4: `frontend/src/components/ResultsPanel.module.css`에 스타일 추가**

`.noteTag { ... }` 블록 바로 아래에 추가:
```css

.dataGapTag {
  font-size: 12px;
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  border: 1px dashed var(--border);
  font-style: italic;
}
```

- [ ] **Step 5: 수동 검증**

터미널 두 개를 열어 백엔드/프론트를 각각 띄운다:
```bash
# 터미널 1
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000
```
```bash
# 터미널 2
cd frontend && npm run dev
```
브라우저에서 http://localhost:3000 접속 후:
1. 아무 추천이나 받아서 퍼센트 배지가 "OO%"가 아니라 "추천 지수 OO"로 보이는지 확인
2. 상대 팀 픽에 아직 카운터/시너지/검토완료-중립 데이터가 없는 영웅(예: 시드에
   거의 안 나오는 조합)을 넣어 추천을 받아, 결과 카드에 "데이터 없음 · ..." 형태의
   점선 테두리 배지가 뜨는지 확인
3. 필수픽 배지가 붙은 항목이 있다면(있으면) 퍼센트가 100%가 아니라 90%대 값으로
   표시되는지 확인 (tanh 포화 곡선 반영 확인)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/components/ResultsPanel.tsx frontend/src/components/ResultsPanel.module.css
git commit -m "feat: relabel percentage as recommendation index and render data_gaps badges"
```

---

## Task 6: 필수픽 임계치 실증 검증

**Files:**
- Create: `backend/scripts/audit_must_pick_distribution.py`
- Create: `backend/scripts/__init__.py`
- Modify: `docs/superpowers/specs/2026-09-07-overwatch-hero-recommender-design.md`

**Interfaces:**
- Consumes: `backend.app.scoring.score_candidates`, 실제 시드 JSON
  (`seed-data/heroes.json`, `counter_relations.json`, `synergy_relations.json`)
- Produces: 없음 (분석 스크립트 + 스펙 문서 결론 반영)

**참고:** 이 태스크는 우선순위 1~3(Task 1~5)을 실제로 반영한 뒤에만 의미가 있다
(스펙의 "스코어링 개선 검토" 표 참고) — 순서를 앞당기지 않는다. 결과 판단은
자동화된 pass/fail이 아니라 출력된 분포를 사람이 보고 판단하는 성격의 작업이라,
이 태스크의 "테스트"는 스크립트가 에러 없이 실행되고 합리적인 형태의 출력을
내는지 확인하는 것이다.

- [ ] **Step 1: `backend/scripts/__init__.py` 생성 (빈 파일)**

- [ ] **Step 2: `backend/scripts/audit_must_pick_distribution.py` 작성**

```python
"""필수픽 임계치(config.MUST_PICK_PERCENTAGE_THRESHOLD) 실증 검증용 스크립트.

실제 큐레이션된 시드 데이터(seed-data/*.json, DB 아님 — scoring.py는 DB에
의존하지 않는 순수 함수라 JSON을 직접 읽어도 충분하다)를 대상으로:

1. "카운터 단독" 시나리오: counter_relations의 각 행마다, 그 후보가 딱 그
   상대 영웅 하나만 상대하는 상황을 가정하고 채점한다.
2. "시너지 단독" 시나리오: synergy_relations의 각 행마다 동일하게 채점한다.
3. "카운터+시너지 결합" 시나리오: 같은 후보가 counter_relations와
   synergy_relations 양쪽에 모두 등장하는 경우, 그 둘을 합쳐서 채점한다.

각 그룹에서 is_must_pick이 몇 건이나 발동하는지, percentage 분포(최소/최대/
평균)가 어떤지 출력한다. 이 출력을 보고 MUST_PICK_PERCENTAGE_THRESHOLD나
PERCENTAGE_SCALE을 조정할지 사람이 판단한다.

실행 (backend/ 디렉토리, 가상환경 활성화 상태에서):
    python3 -m scripts.audit_must_pick_distribution
"""
import json
import statistics
from pathlib import Path

from app.scoring import score_candidates

SEED_DIR = Path(__file__).resolve().parent.parent.parent / "seed-data"


def load(name: str):
    with open(SEED_DIR / name, encoding="utf-8") as f:
        return json.load(f)


def summarize(label: str, percentages: list[int], must_pick_count: int) -> None:
    print(f"\n[{label}] {len(percentages)}건")
    if not percentages:
        print("  (데이터 없음)")
        return
    print(f"  percentage: min={min(percentages)} max={max(percentages)} "
          f"avg={statistics.mean(percentages):.1f}")
    print(f"  is_must_pick 발동: {must_pick_count}건 "
          f"({must_pick_count / len(percentages) * 100:.1f}%)")


def main() -> None:
    heroes = load("heroes.json")
    heroes_by_id = {h["id"]: h for h in heroes}
    counters = load("counter_relations.json")
    synergies = load("synergy_relations.json")

    def candidate_for(hero_id: str) -> dict:
        h = heroes_by_id[hero_id]
        return {"id": h["id"], "name": h["name"], "role": h["role"], "archetype": h.get("archetype", "")}

    # 1) 카운터 단독
    counter_only_pct: list[int] = []
    counter_only_must_pick = 0
    for row in counters:
        result = score_candidates(
            [candidate_for(row["hero_id"])],
            [row],
            [],
            [],
        )[0]
        counter_only_pct.append(result.percentage)
        counter_only_must_pick += int(result.is_must_pick)
    summarize("카운터 단독", counter_only_pct, counter_only_must_pick)

    # 2) 시너지 단독
    synergy_only_pct: list[int] = []
    synergy_only_must_pick = 0
    for row in synergies:
        result = score_candidates(
            [candidate_for(row["hero_id"])],
            [],
            [row],
            [],
        )[0]
        synergy_only_pct.append(result.percentage)
        synergy_only_must_pick += int(result.is_must_pick)
    summarize("시너지 단독", synergy_only_pct, synergy_only_must_pick)

    # 3) 카운터+시너지 결합 (같은 후보가 두 리스트 모두에 등장하는 경우)
    counter_heroes = {row["hero_id"] for row in counters}
    synergy_heroes = {row["hero_id"] for row in synergies}
    combined_pct: list[int] = []
    combined_must_pick = 0
    for hero_id in counter_heroes & synergy_heroes:
        hero_counters = [r for r in counters if r["hero_id"] == hero_id]
        hero_synergies = [r for r in synergies if r["hero_id"] == hero_id]
        result = score_candidates(
            [candidate_for(hero_id)],
            hero_counters[:1],
            hero_synergies[:1],
            [],
        )[0]
        combined_pct.append(result.percentage)
        combined_must_pick += int(result.is_must_pick)
    summarize("카운터+시너지 결합", combined_pct, combined_must_pick)


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: 실행해서 에러 없이 출력되는지 확인**

Run (`backend/` 디렉토리, 가상환경 활성화 상태에서): `python3 -m scripts.audit_must_pick_distribution`
Expected: 에러 없이 3개 그룹("카운터 단독"/"시너지 단독"/"카운터+시너지 결합")의
건수·percentage 분포·is_must_pick 발동 비율이 출력됨

- [ ] **Step 4: 출력 결과를 검토하고 스펙 문서에 결론 반영**

출력된 분포를 보고 다음을 판단한다:
- "카운터 단독" 그룹의 is_must_pick 발동 비율이 0%에 가까운가? (설계 의도:
  카운터 하나만으로는 필수픽까지는 안 가고, 카운터+시너지나 카운터+맵처럼
  다른 신호가 하나 더 겹쳐야 90%를 넘는 것이 바람직함)
- "카운터+시너지 결합" 그룹에서 is_must_pick 발동 비율이 너무 낮거나(거의 다
  90% 미만 → 필수픽 배지가 사실상 안 뜸) 너무 높지(대부분 90% 이상 → 배지가
  흔해서 변별력 없음) 않은가?

`docs/superpowers/specs/2026-09-07-overwatch-hero-recommender-design.md`의
"스코어링 개선 검토 (2026-09-08)" 표에서 4번 행("필수픽 배지 임계치 검증")의
상태를 "실증 검증 필요"에서 아래처럼 실제 결과로 교체한다 (실행해서 나온 실제
숫자로 채울 것 — 아래는 채워 넣는 형식 예시):

```markdown
| 4 | 필수픽 배지 임계치(`MUST_PICK_PERCENTAGE_THRESHOLD = 90`) 검증 | **검증 완료 (2026-09-08)** | `backend/scripts/audit_must_pick_distribution.py`로 실제 시드 데이터 기준 분포 확인. 카운터 단독 [N]건 중 필수픽 발동 [N]건([X]%), 카운터+시너지 결합 [N]건 중 [N]건([X]%). [임계치를 90으로 유지함 / N으로 조정함] — [판단 근거 한 줄] |
```

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/audit_must_pick_distribution.py backend/scripts/__init__.py docs/superpowers/specs/2026-09-07-overwatch-hero-recommender-design.md
git commit -m "chore: audit must-pick threshold against real seed data"
```
