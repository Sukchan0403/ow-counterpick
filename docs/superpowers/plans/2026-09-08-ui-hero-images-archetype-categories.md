# UI 리디자인 — 영웅 이미지 · 아키타입 카테고리 그룹핑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 결과 카드와 영웅 선택 그리드에 블리자드 공식 영웅 초상화(핫링크)를 추가하고,
영웅 선택 그리드를 역할(돌격/공격/지원) → 아키타입 카테고리 → 영웅 순서로
재구성한다.

**Architecture:** `heroes` 테이블에 `icon_url`(블리자드 CDN URL)과
`archetype_category`(그룹 필터링용 상위 분류) 컬럼을 추가하고, 기존 데이터
흐름(repository → scoring/catalog → API 응답 → 프론트 타입)에 그대로 얹어
전달한다. 런타임에 외부 API 호출은 없음 — OverFast API는 이 플랜의 시드
데이터 작성 단계에서 값을 확보하는 데만 쓰인다.

**Tech Stack:** Python/FastAPI/SQLite (백엔드), TypeScript/Next.js (프론트,
자동 테스트 인프라 없음 — 기존 관례대로 수동 검증)

**Spec:** `docs/superpowers/specs/2026-09-07-overwatch-hero-recommender-design.md`
(특히 "UI 리디자인 — 결과 카드 · 영웅 선택 그리드 (2026-09-08)" 섹션)

## Global Constraints

- `heroes` 테이블에 `icon_url TEXT NOT NULL DEFAULT ''`,
  `archetype_category TEXT NOT NULL DEFAULT ''` 컬럼 추가. CHECK 제약은
  안 건다(`maps.mode`와 같은 기존 관례).
- 아키타입 카테고리 유효값(역할별):
  - 돌격(tank): 개시자 / 투사 / 강건한 자
  - 공격(damage): 전문가 / 수색가 / 측면 공격가 / 명사수
  - 지원(support): 전술가 / 의무관 / 생존왕
- 현재 15명 로스터 배정: 개시자(윈스턴, 디바) / 투사(오리사, 자리야) /
  강건한 자(라인하르트) / 측면 공격가(겐지, 트레이서) / 명사수(위도우메이커,
  소전) / 전술가(아나, 루시우, 바티스트, 젠야타) / 의무관(모이라, 키리코)
- 영웅 이미지는 블리자드 CDN(`d15f34w2p8l1cc.cloudfront.net`) URL을 시드
  데이터에 저장하고 런타임엔 그대로 `<img src>` 핫링크 — 서비스가 직접
  호스팅하거나 외부 API를 런타임에 호출하지 않는다.
- 역할 표시 라벨을 "탱커/딜러/힐러"에서 공식 용어 "돌격/공격/지원"으로
  변경한다. DB의 `role` 컬럼 값(`tank`/`damage`/`support`) 자체는 안 바꾼다.
- `icon_url`이 빈 문자열이면(마이그레이션 직후 등) 이미지 대신 이름 첫
  글자를 넣은 단색 원으로 폴백한다.
- 빈 아키타입 카테고리(현재 로스터에 해당 영웅이 없는 카테고리)는 소제목
  자체를 렌더링하지 않는다. `archetype_category`가 알려진 10개 값 중 어디에도
  안 속하는 영웅은 "기타" 그룹으로 묶어 절대 사라지지 않게 한다.
- 프론트엔드에는 자동 테스트 인프라가 없다(기존 관례) — 이 플랜의 프론트
  태스크는 수동 검증으로 진행한다.
- 각 태스크의 마지막 스텝은 항상 git commit이다.

---

## Task 1: DB 스키마 — `icon_url`/`archetype_category` 컬럼 + repository 조회 함수 갱신

**Files:**
- Modify: `seed-data/seed_db.py`
- Modify: `backend/tests/conftest.py`
- Modify: `backend/app/repository.py`
- Create: `backend/tests/test_repository.py`

**Interfaces:**
- Consumes: 없음
- Produces: `fetch_all_heroes`/`fetch_heroes_by_role`가 반환하는 각 행에
  `icon_url`, `archetype_category` 컬럼 포함 — Task 3, 4가 사용. `conn` pytest
  fixture(`conftest.py`) — Task 1의 신규 테스트가 사용

- [ ] **Step 1: git 저장소 확인 (초기화 안 돼 있으면 초기화)**

```bash
git status || git init
```

- [ ] **Step 2: `seed-data/seed_db.py`의 마이그레이션 블록 확장**

기존:
```python
    # 마이그레이션: v0 스키마로 이미 만들어진 DB 파일에는 archetype 컬럼이 없을 수
    # 있음(CREATE TABLE IF NOT EXISTS라 기존 테이블은 안 바뀜). 없으면 추가.
    existing_cols = {row[1] for row in conn.execute("PRAGMA table_info(heroes)")}
    if "archetype" not in existing_cols:
        conn.execute("ALTER TABLE heroes ADD COLUMN archetype TEXT NOT NULL DEFAULT ''")
```
다음으로 교체:
```python
    # 마이그레이션: v0 스키마로 이미 만들어진 DB 파일에는 archetype 컬럼이 없을 수
    # 있음(CREATE TABLE IF NOT EXISTS라 기존 테이블은 안 바뀜). 없으면 추가.
    existing_cols = {row[1] for row in conn.execute("PRAGMA table_info(heroes)")}
    if "archetype" not in existing_cols:
        conn.execute("ALTER TABLE heroes ADD COLUMN archetype TEXT NOT NULL DEFAULT ''")
    if "icon_url" not in existing_cols:
        conn.execute("ALTER TABLE heroes ADD COLUMN icon_url TEXT NOT NULL DEFAULT ''")
    if "archetype_category" not in existing_cols:
        conn.execute("ALTER TABLE heroes ADD COLUMN archetype_category TEXT NOT NULL DEFAULT ''")
```

- [ ] **Step 3: `backend/tests/conftest.py`의 `_SCHEMA` 중 `heroes` 테이블에 컬럼 추가**

기존:
```sql
CREATE TABLE heroes (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('tank','damage','support')),
    archetype TEXT NOT NULL DEFAULT ''
);
```
다음으로 교체:
```sql
CREATE TABLE heroes (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('tank','damage','support')),
    archetype TEXT NOT NULL DEFAULT '',
    icon_url TEXT NOT NULL DEFAULT '',
    archetype_category TEXT NOT NULL DEFAULT ''
);
```

- [ ] **Step 4: `conftest.py`의 `heroes` INSERT에 실제 값 채우기**

기존:
```python
_conn.executemany(
    "INSERT INTO heroes VALUES (?, ?, ?, ?)",
    [
        ("kiriko", "키리코", "support", "정찰 지원"),
        ("lucio", "루시우", "support", "기동 지원"),
        ("moira", "모이라", "support", "근접 유지 지원"),
        ("ana", "아나", "support", "디나이얼 지원"),
        ("widowmaker", "위도우메이커", "damage", "저격수"),
        ("genji", "겐지", "damage", "근접 플랭커"),
        ("reinhardt", "라인하르트", "tank", "방벽 수문장"),
    ],
)
```
다음으로 교체:
```python
_conn.executemany(
    "INSERT INTO heroes VALUES (?, ?, ?, ?, ?, ?)",
    [
        ("kiriko", "키리코", "support", "정찰 지원",
         "https://d15f34w2p8l1cc.cloudfront.net/overwatch/408603fe037e8576078eaac5eab2fb251489ced4003b11f5f522776d43d0b83d.png",
         "의무관"),
        ("lucio", "루시우", "support", "기동 지원",
         "https://d15f34w2p8l1cc.cloudfront.net/overwatch/040bb13f5123ab93faad2f95627ba184608aef4b2469a4d3003859c7087df044.png",
         "전술가"),
        ("moira", "모이라", "support", "근접 유지 지원",
         "https://d15f34w2p8l1cc.cloudfront.net/overwatch/f48f8485056d5d00dad195859188d23e50f7126b8b08b5646f46ef1b42f5e1de.png",
         "의무관"),
        ("ana", "아나", "support", "디나이얼 지원",
         "https://d15f34w2p8l1cc.cloudfront.net/overwatch/985b06beae46b7ba3ca87d1512d0fc62ca7f206ceca58ef16fc44d43a1cc84ed.png",
         "전술가"),
        ("widowmaker", "위도우메이커", "damage", "저격수",
         "https://d15f34w2p8l1cc.cloudfront.net/overwatch/6e4702b45f196aaf51555cf57327322721f45458b17f5f0643ed008a88378259.png",
         "명사수"),
        ("genji", "겐지", "damage", "근접 플랭커",
         "https://d15f34w2p8l1cc.cloudfront.net/overwatch/156b12c20b1aea872c1eeb5bb37a7de1047b2ab30ecefd0663a8925badde1ea8.png",
         "측면 공격가"),
        ("reinhardt", "라인하르트", "tank", "방벽 수문장",
         "https://d15f34w2p8l1cc.cloudfront.net/overwatch/551fbe070c16fdfcc17f7f1de63af22c53e7d2f1340fc2f3172441504527bc4e.png",
         "강건한 자"),
    ],
)
```

- [ ] **Step 5: `client` fixture 바로 아래에 `conn` fixture 추가**

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

(`sqlite3`는 파일 상단에 이미 import돼 있음)

- [ ] **Step 6: 실패하는 테스트 작성 — `backend/tests/test_repository.py`**

```python
"""repository.py의 heroes 조회 함수가 icon_url/archetype_category를 포함하는지 검증."""
from app.repository import fetch_all_heroes, fetch_heroes_by_role


def test_fetch_all_heroes_includes_icon_and_archetype_category(conn):
    rows = fetch_all_heroes(conn)
    kiriko = next(r for r in rows if r["id"] == "kiriko")
    assert kiriko["icon_url"].startswith("https://d15f34w2p8l1cc.cloudfront.net/")
    assert kiriko["archetype_category"] == "의무관"


def test_fetch_heroes_by_role_includes_icon_and_archetype_category(conn):
    rows = fetch_heroes_by_role(conn, "support")
    kiriko = next(r for r in rows if r["id"] == "kiriko")
    assert kiriko["icon_url"].startswith("https://d15f34w2p8l1cc.cloudfront.net/")
    assert kiriko["archetype_category"] == "의무관"
```

- [ ] **Step 7: 테스트 실행 → 실패 확인**

Run (`backend/` 디렉토리, 가상환경 활성화 상태에서): `pytest tests/test_repository.py -v`
Expected: FAIL (`sqlite3.OperationalError: no such column: icon_url` 등)

- [ ] **Step 8: `backend/app/repository.py`의 두 함수 SELECT 절 수정**

기존:
```python
def fetch_all_heroes(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT id, name, role, archetype FROM heroes").fetchall()


def fetch_heroes_by_role(conn: sqlite3.Connection, role: str) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT id, name, role, archetype FROM heroes WHERE role = ?", (role,)
    ).fetchall()
```
다음으로 교체:
```python
def fetch_all_heroes(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT id, name, role, archetype, icon_url, archetype_category FROM heroes"
    ).fetchall()


def fetch_heroes_by_role(conn: sqlite3.Connection, role: str) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT id, name, role, archetype, icon_url, archetype_category FROM heroes WHERE role = ?",
        (role,),
    ).fetchall()
```

- [ ] **Step 9: 테스트 실행 → 통과 확인**

Run: `pytest tests/test_repository.py -v`
Expected: PASS

- [ ] **Step 10: 전체 백엔드 테스트 실행 (회귀 확인)**

Run: `pytest -v`
Expected: 전체 PASS (`conftest.py`가 만드는 테스트 DB가 바뀌었으니 기존
`test_get_heroes` 등도 이 스텝에서 같이 돌아간다 — 아직 API 응답 필드는
안 건드렸으니 통과해야 함)

- [ ] **Step 11: `seed_db.py`의 `main()`에 있는 heroes INSERT 문에도 새 컬럼 반영**

이 스텝을 빠뜨리면 Task 2에서 `heroes.json`에 `icon_url`/`archetype_category`를
채워도 실제로 DB에 안 들어간다(INSERT 문이 그 키를 안 읽으므로 컬럼 기본값
`''`으로만 남음). 기존:
```python
    conn.executemany(
        "INSERT OR REPLACE INTO heroes (id, name, role, archetype) "
        "VALUES (:id, :name, :role, :archetype)",
        heroes,
    )
```
다음으로 교체:
```python
    conn.executemany(
        "INSERT OR REPLACE INTO heroes (id, name, role, archetype, icon_url, archetype_category) "
        "VALUES (:id, :name, :role, :archetype, :icon_url, :archetype_category)",
        heroes,
    )
```

- [ ] **Step 12: Commit**

```bash
git add seed-data/seed_db.py backend/tests/conftest.py backend/app/repository.py backend/tests/test_repository.py
git commit -m "feat: add icon_url and archetype_category columns to heroes table"
```

---

## Task 2: `seed-data/heroes.json` 실제 콘텐츠 갱신

**Files:**
- Modify: `seed-data/heroes.json`

**Interfaces:**
- 없음 (콘텐츠 파일)

- [ ] **Step 1: `seed-data/heroes.json` 전체 교체**

```json
[
  { "id": "reinhardt", "name": "라인하르트", "role": "tank", "archetype": "방벽 수문장", "archetype_category": "강건한 자", "icon_url": "https://d15f34w2p8l1cc.cloudfront.net/overwatch/551fbe070c16fdfcc17f7f1de63af22c53e7d2f1340fc2f3172441504527bc4e.png" },
  { "id": "orisa", "name": "오리사", "role": "tank", "archetype": "전선 고정수", "archetype_category": "투사", "icon_url": "https://d15f34w2p8l1cc.cloudfront.net/overwatch/a73958a28551f5254f3ab3f97c5f5f8d698a95c0b6a515d1a2b1caac169205a6.png" },
  { "id": "winston", "name": "윈스턴", "role": "tank", "archetype": "개시자", "archetype_category": "개시자", "icon_url": "https://d15f34w2p8l1cc.cloudfront.net/overwatch/46a10db3aa908c590ddc4e7606376a88143d1f1306ecfbea043263040f9529a5.png" },
  { "id": "dva", "name": "디바", "role": "tank", "archetype": "항공 저지", "archetype_category": "개시자", "icon_url": "https://d15f34w2p8l1cc.cloudfront.net/overwatch/df5a5532862d9292634fb3dc0e51a4705aa601de65e5e815513ccc663d84de56.png" },
  { "id": "zarya", "name": "자리야", "role": "tank", "archetype": "에너지 방벽", "archetype_category": "투사", "icon_url": "https://d15f34w2p8l1cc.cloudfront.net/overwatch/9b6f63cc66ddf9d5e0862173c733cc0d2e574c5c89357798d91b93b2f95a7080.png" },

  { "id": "genji", "name": "겐지", "role": "damage", "archetype": "근접 플랭커", "archetype_category": "측면 공격가", "icon_url": "https://d15f34w2p8l1cc.cloudfront.net/overwatch/156b12c20b1aea872c1eeb5bb37a7de1047b2ab30ecefd0663a8925badde1ea8.png" },
  { "id": "widowmaker", "name": "위도우메이커", "role": "damage", "archetype": "저격수", "archetype_category": "명사수", "icon_url": "https://d15f34w2p8l1cc.cloudfront.net/overwatch/6e4702b45f196aaf51555cf57327322721f45458b17f5f0643ed008a88378259.png" },
  { "id": "tracer", "name": "트레이서", "role": "damage", "archetype": "고기동 교란", "archetype_category": "측면 공격가", "icon_url": "https://d15f34w2p8l1cc.cloudfront.net/overwatch/4504f6f15cb3feaa92ecd38e01dcf751cb5abdac2e0bb52d0555727e53277502.png" },
  { "id": "sojourn", "name": "소전", "role": "damage", "archetype": "원거리 포격", "archetype_category": "명사수", "icon_url": "https://d15f34w2p8l1cc.cloudfront.net/overwatch/82b8c1b8765dcb9a0ba16e343c3516bf324c771ac81e9878473280216e70a889.png" },

  { "id": "ana", "name": "아나", "role": "support", "archetype": "디나이얼 지원", "archetype_category": "전술가", "icon_url": "https://d15f34w2p8l1cc.cloudfront.net/overwatch/985b06beae46b7ba3ca87d1512d0fc62ca7f206ceca58ef16fc44d43a1cc84ed.png" },
  { "id": "moira", "name": "모이라", "role": "support", "archetype": "근접 유지 지원", "archetype_category": "의무관", "icon_url": "https://d15f34w2p8l1cc.cloudfront.net/overwatch/f48f8485056d5d00dad195859188d23e50f7126b8b08b5646f46ef1b42f5e1de.png" },
  { "id": "kiriko", "name": "키리코", "role": "support", "archetype": "정찰 지원", "archetype_category": "의무관", "icon_url": "https://d15f34w2p8l1cc.cloudfront.net/overwatch/408603fe037e8576078eaac5eab2fb251489ced4003b11f5f522776d43d0b83d.png" },
  { "id": "lucio", "name": "루시우", "role": "support", "archetype": "기동 지원", "archetype_category": "전술가", "icon_url": "https://d15f34w2p8l1cc.cloudfront.net/overwatch/040bb13f5123ab93faad2f95627ba184608aef4b2469a4d3003859c7087df044.png" },
  { "id": "baptiste", "name": "바티스트", "role": "support", "archetype": "생존 지원", "archetype_category": "전술가", "icon_url": "https://d15f34w2p8l1cc.cloudfront.net/overwatch/d4e6f1ca45d9f88fa89260787397f141a6f007b14e5b26698883b6a17bab9680.png" },
  { "id": "zenyatta", "name": "젠야타", "role": "support", "archetype": "원거리 지원", "archetype_category": "전술가", "icon_url": "https://d15f34w2p8l1cc.cloudfront.net/overwatch/7d1546b1541a8afc39353f9337a408d6275a141b0432b7e560ef61579996b0fc.png" }
]
```

- [ ] **Step 2: 시드 스크립트 실행해서 정상 반영 확인**

Run (`seed-data/` 디렉토리에서): `python3 seed_db.py /tmp/ow_ui_plan_check.db`
Expected: 에러 없이 완료, "무결성 체크 통과" 메시지 출력

- [ ] **Step 3: 실제로 컬럼이 채워졌는지 직접 조회로 확인**

Run: `python3 -c "import sqlite3; c = sqlite3.connect('/tmp/ow_ui_plan_check.db'); print(c.execute(\"SELECT id, icon_url, archetype_category FROM heroes WHERE id='kiriko'\").fetchone())"`
Expected: `('kiriko', 'https://d15f34w2p8l1cc.cloudfront.net/overwatch/408603fe...png', '의무관')`

- [ ] **Step 4: Commit**

```bash
git add seed-data/heroes.json
git commit -m "content: add icon_url and archetype_category to seed hero data"
```

---

## Task 3: `GET /api/heroes`에 `icon_url`/`archetype_category` 반영

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/routers/catalog.py`
- Modify: `backend/tests/test_api.py`

**Interfaces:**
- Consumes: `fetch_all_heroes` (Task 1)
- Produces: `HeroOut.icon_url`, `HeroOut.archetype_category` — 프론트가 `GET /api/heroes` 응답으로 소비

- [ ] **Step 1: 실패하는 테스트로 기대값 추가 — `backend/tests/test_api.py`**

기존 `test_get_heroes`를:
```python
def test_get_heroes(client):
    res = client.get("/api/heroes")
    assert res.status_code == 200
    heroes = {h["id"]: h for h in res.json()}
    assert "kiriko" in heroes and "genji" in heroes
    assert heroes["kiriko"]["archetype"] == "정찰 지원"
```
다음으로 교체:
```python
def test_get_heroes(client):
    res = client.get("/api/heroes")
    assert res.status_code == 200
    heroes = {h["id"]: h for h in res.json()}
    assert "kiriko" in heroes and "genji" in heroes
    assert heroes["kiriko"]["archetype"] == "정찰 지원"
    assert heroes["kiriko"]["archetype_category"] == "의무관"
    assert heroes["kiriko"]["icon_url"].startswith("https://d15f34w2p8l1cc.cloudfront.net/")
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `pytest tests/test_api.py -v -k test_get_heroes`
Expected: FAIL (`KeyError: 'archetype_category'`)

- [ ] **Step 3: `backend/app/models.py`의 `HeroOut`에 필드 추가**

**주의**: `models.py`에는 `archetype: str = Field(...)` 블록이 `HeroOut`과
`HeroRecommendation` 두 군데 있다. 아래는 `HeroOut`에만 있는 고유한 설명
문구("역할 세부 서브타이틀 (예: '정찰 지원'...")로 앵커를 잡는다 —
`HeroRecommendation` 쪽(Task 4에서 수정 예정)은 건드리지 않는다.

기존:
```python
    archetype: str = Field(
        description="역할 세부 서브타이틀 (예: '정찰 지원', '방벽 수문장'). Main/Result 목업의 "
        "'힐러 · 정찰 지원' 같은 표시에 쓰임."
    )
```
다음으로 교체:
```python
    archetype: str = Field(
        description="역할 세부 서브타이틀 (예: '정찰 지원', '방벽 수문장'). Main/Result 목업의 "
        "'힐러 · 정찰 지원' 같은 표시에 쓰임."
    )
    icon_url: str = Field(
        description="블리자드 CDN 초상화 URL. OverFast API에서 확보해 시드에 저장하고 런타임엔 그대로 핫링크."
    )
    archetype_category: str = Field(
        description="그룹 필터링용 상위 분류(예: '의무관', '개시자'). 스펙의 아키타입 카테고리 표 참고."
    )
```

- [ ] **Step 4: `backend/app/routers/catalog.py`의 `get_heroes()` 수정**

```python
@router.get("/heroes", response_model=list[HeroOut])
def get_heroes():
    with db_session() as conn:
        rows = fetch_all_heroes(conn)
        return [
            HeroOut(id=r["id"], name=r["name"], role=r["role"], archetype=r["archetype"])
            for r in rows
        ]
```
다음으로 교체:
```python
@router.get("/heroes", response_model=list[HeroOut])
def get_heroes():
    with db_session() as conn:
        rows = fetch_all_heroes(conn)
        return [
            HeroOut(
                id=r["id"],
                name=r["name"],
                role=r["role"],
                archetype=r["archetype"],
                icon_url=r["icon_url"],
                archetype_category=r["archetype_category"],
            )
            for r in rows
        ]
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `pytest tests/test_api.py -v`
Expected: 전체 PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/models.py backend/app/routers/catalog.py backend/tests/test_api.py
git commit -m "feat: expose icon_url and archetype_category via GET /api/heroes"
```

---

## Task 4: 추천 응답에도 `icon_url`/`archetype_category` 반영

**Files:**
- Modify: `backend/app/scoring.py`
- Modify: `backend/app/models.py`
- Modify: `backend/app/routers/recommendations.py`
- Modify: `backend/tests/test_scoring.py`
- Modify: `backend/tests/test_api.py`

**Interfaces:**
- Consumes: `fetch_heroes_by_role`이 반환하는 `icon_url`/`archetype_category` (Task 1)
- Produces: `ScoredHero.icon_url`/`ScoredHero.archetype_category`,
  `HeroRecommendation.icon_url`/`HeroRecommendation.archetype_category` —
  Task 6, 7의 프론트가 소비

- [ ] **Step 1: 실패하는 테스트 작성 — `backend/tests/test_scoring.py`에 추가**

```python
def test_icon_url_and_archetype_category_default_to_empty_when_absent():
    candidates = make_candidates()  # icon_url/archetype_category 키 없음
    result = score_candidates(candidates, [], [], [])
    by_id = {s.hero_id: s for s in result}
    assert by_id["kiriko"].icon_url == ""
    assert by_id["kiriko"].archetype_category == ""


def test_icon_url_and_archetype_category_pass_through_when_present():
    candidates = [
        {
            "id": "kiriko",
            "name": "키리코",
            "role": "support",
            "archetype": "정찰 지원",
            "icon_url": "https://example.com/kiriko.png",
            "archetype_category": "의무관",
        },
    ]
    result = score_candidates(candidates, [], [], [])
    assert result[0].icon_url == "https://example.com/kiriko.png"
    assert result[0].archetype_category == "의무관"
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `pytest tests/test_scoring.py -v -k icon_url`
Expected: FAIL (`AttributeError: 'ScoredHero' object has no attribute 'icon_url'`)

- [ ] **Step 3: `backend/app/scoring.py`의 `ScoredHero`에 필드 추가**

`notes: list[str] = field(default_factory=list)` 줄 바로 아래에 추가:
```python
    icon_url: str = ""
    archetype_category: str = ""
```

- [ ] **Step 4: `score_candidates` 내 `ScoredHero(...)` 생성 부분 수정**

기존:
```python
        scored = ScoredHero(
            hero_id=cid,
            hero_name=candidate["name"],
            role=candidate["role"],
            archetype=candidate.get("archetype", ""),
        )
```
다음으로 교체:
```python
        scored = ScoredHero(
            hero_id=cid,
            hero_name=candidate["name"],
            role=candidate["role"],
            archetype=candidate.get("archetype", ""),
            icon_url=candidate.get("icon_url", ""),
            archetype_category=candidate.get("archetype_category", ""),
        )
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `pytest tests/test_scoring.py -v`
Expected: 전체 PASS

- [ ] **Step 6: 실패하는 테스트 작성 — `backend/tests/test_api.py`에 추가**

```python
def test_recommendation_includes_icon_url_and_archetype_category(client):
    res = client.post(
        "/api/recommendations",
        json={
            "enemy_heroes": [],
            "our_heroes": [],
            "empty_position": "support",
            "map_id": "eichenwalde",
        },
    )
    body = res.json()
    kiriko_row = next(r for r in body["recommendations"] if r["hero_id"] == "kiriko")
    assert kiriko_row["icon_url"].startswith("https://d15f34w2p8l1cc.cloudfront.net/")
    assert kiriko_row["archetype_category"] == "의무관"
```

- [ ] **Step 7: 테스트 실행 → 실패 확인**

Run: `pytest tests/test_api.py -v -k icon_url`
Expected: FAIL (`KeyError: 'icon_url'`)

- [ ] **Step 8: `backend/app/models.py`의 `HeroRecommendation`에 필드 추가**

**주의**: 이 시점에 `models.py`에는 `archetype: str = Field(...)` 블록이 두 개
있다(`HeroOut`용은 Task 3에서 이미 수정 완료, `HeroRecommendation`용은 아직
미수정). 아래 앵커는 `HeroRecommendation` 안에만 있는 고유한 설명 문구
("Result.dc.html의 '힐러 · 정찰 지원' 같은 서브타이틀...")로 특정한다 —
`HeroOut` 쪽을 건드리지 않도록 주의.

기존:
```python
    archetype: str = Field(
        description="Result.dc.html의 '힐러 · 정찰 지원' 같은 서브타이틀. HeroOut.archetype과 동일 값."
    )
    total_score: int
```
다음으로 교체:
```python
    archetype: str = Field(
        description="Result.dc.html의 '힐러 · 정찰 지원' 같은 서브타이틀. HeroOut.archetype과 동일 값."
    )
    icon_url: str = Field(default="", description="블리자드 CDN 초상화 URL 핫링크용")
    archetype_category: str = Field(default="", description="그룹 필터링용 상위 분류")
    total_score: int
```

- [ ] **Step 9: `backend/app/routers/recommendations.py`의 `candidates` 구성 및 `HeroRecommendation` 생성부 수정**

기존:
```python
        candidates = [
            {"id": r["id"], "name": r["name"], "role": r["role"], "archetype": r["archetype"]}
            for r in role_heroes
            if r["id"] not in already_picked
        ]
```
다음으로 교체:
```python
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
```

`notes=s.notes,` 줄 바로 아래에 추가:
```python
            icon_url=s.icon_url,
            archetype_category=s.archetype_category,
```

- [ ] **Step 10: 테스트 실행 → 통과 확인**

Run: `pytest tests/test_api.py -v`
Expected: 전체 PASS

- [ ] **Step 11: 전체 백엔드 테스트 실행 (회귀 확인)**

Run: `pytest -v`
Expected: 전체 PASS

- [ ] **Step 12: Commit**

```bash
git add backend/app/scoring.py backend/app/models.py backend/app/routers/recommendations.py backend/tests/test_scoring.py backend/tests/test_api.py
git commit -m "feat: surface icon_url and archetype_category through POST /api/recommendations"
```

---

## Task 5: 프론트엔드 타입 + `ROLE_LABEL`/`ARCHETYPE_CATEGORY_ORDER` 추가

**Files:**
- Modify: `frontend/src/lib/types.ts`

**Interfaces:**
- Produces: `Hero.icon_url`/`Hero.archetype_category`,
  `HeroRecommendation.icon_url`/`HeroRecommendation.archetype_category`,
  `ARCHETYPE_CATEGORY_ORDER: Record<Role, string[]>`, 갱신된 `ROLE_LABEL` —
  Task 6, 7이 사용

- [ ] **Step 1: `Hero` 인터페이스에 필드 추가**

```typescript
export interface Hero {
  id: string;
  name: string;
  role: Role;
  archetype: string;
  icon_url: string;
  archetype_category: string;
}
```

- [ ] **Step 2: `HeroRecommendation` 인터페이스에 필드 추가**

```typescript
export interface HeroRecommendation {
  hero_id: string;
  hero_name: string;
  role: Role;
  archetype: string;
  icon_url: string;
  archetype_category: string;
  total_score: number;
  percentage: number;
  score_breakdown: ScoreBreakdown;
  reasons: string[];
  is_must_pick: boolean;
  notes: string[];
}
```

- [ ] **Step 3: `ROLE_LABEL`을 공식 용어로 교체**

```typescript
export const ROLE_LABEL: Record<Role, string> = {
  tank: "돌격",
  damage: "공격",
  support: "지원",
};
```

- [ ] **Step 4: `ARCHETYPE_CATEGORY_ORDER` 추가 (`ROLE_LABEL` 바로 아래)**

```typescript
// 블리자드 공식 아키타입 카테고리 (역할별 유효값, 표시 순서 고정).
// 스펙의 "UI 리디자인" 섹션 표 참고.
export const ARCHETYPE_CATEGORY_ORDER: Record<Role, string[]> = {
  tank: ["개시자", "투사", "강건한 자"],
  damage: ["전문가", "수색가", "측면 공격가", "명사수"],
  support: ["전술가", "의무관", "생존왕"],
};
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/types.ts
git commit -m "feat: add icon_url/archetype_category types and official role labels"
```

(프론트 타입 전용 변경이라 자동 테스트 없음 — Task 6, 7에서 실제 렌더링으로
검증한다.)

---

## Task 6: `HeroPickerPanel` 재구성 — 아키타입 카테고리 소제목 + 아이콘 칩

**Files:**
- Modify: `frontend/src/components/HeroPickerPanel.tsx`
- Modify: `frontend/src/components/HeroPickerPanel.module.css`

**Interfaces:**
- Consumes: `Hero.icon_url`/`Hero.archetype_category`, `ARCHETYPE_CATEGORY_ORDER`, `ROLE_LABEL` (Task 5)

**참고:** 자동 테스트 인프라가 없어(기존 관례) 수동 검증으로 진행한다.

- [ ] **Step 1: `frontend/src/components/HeroPickerPanel.tsx` 전체 교체**

```tsx
import type { Hero, Role } from "@/lib/types";
import { ARCHETYPE_CATEGORY_ORDER, ROLE_LABEL } from "@/lib/types";
import styles from "./HeroPickerPanel.module.css";

const ROLE_ORDER: Role[] = ["tank", "damage", "support"];
const UNCATEGORIZED_LABEL = "기타";

interface Props {
  title: string;
  heroes: Hero[];
  selectedIds: string[];
  maxCount: number;
  onChange: (ids: string[]) => void;
}

export function HeroPickerPanel({ title, heroes, selectedIds, maxCount, onChange }: Props) {
  const atMax = selectedIds.length >= maxCount;

  function toggle(heroId: string) {
    if (selectedIds.includes(heroId)) {
      onChange(selectedIds.filter((id) => id !== heroId));
    } else if (!atMax) {
      onChange([...selectedIds, heroId]);
    }
  }

  function renderHeroButton(hero: Hero) {
    const selected = selectedIds.includes(hero.id);
    return (
      <button
        key={hero.id}
        type="button"
        onClick={() => toggle(hero.id)}
        disabled={!selected && atMax}
        className={`${styles.heroButton} ${selected ? styles.heroButtonSelected : ""}`}
      >
        {hero.icon_url ? (
          <img src={hero.icon_url} alt="" className={styles.heroIcon} />
        ) : (
          <span className={styles.heroIconFallback}>{hero.name[0]}</span>
        )}
        <span className={styles.heroName}>{hero.name}</span>
      </button>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        <span className={styles.count}>
          {selectedIds.length}/{maxCount}
        </span>
      </div>

      {ROLE_ORDER.map((role) => {
        const roleHeroes = heroes.filter((h) => h.role === role);
        if (roleHeroes.length === 0) return null;

        const knownCategories = ARCHETYPE_CATEGORY_ORDER[role];
        const knownSet = new Set(knownCategories);
        const uncategorized = roleHeroes.filter((h) => !knownSet.has(h.archetype_category));
        const groups: { label: string; heroes: Hero[] }[] = [
          ...knownCategories
            .map((category) => ({
              label: category,
              heroes: roleHeroes.filter((h) => h.archetype_category === category),
            }))
            .filter((g) => g.heroes.length > 0),
          ...(uncategorized.length > 0
            ? [{ label: UNCATEGORIZED_LABEL, heroes: uncategorized }]
            : []),
        ];

        return (
          <div key={role} className={styles.roleGroup}>
            <div className={styles.roleLabel}>{ROLE_LABEL[role]}</div>
            {groups.map((group) => (
              <div key={group.label} className={styles.archetypeGroup}>
                <div className={styles.archetypeLabel}>{group.label}</div>
                <div className={styles.heroGrid}>{group.heroes.map(renderHeroButton)}</div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: `frontend/src/components/HeroPickerPanel.module.css` 수정**

`.heroButton` 규칙을:
```css
.heroButton {
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
```
다음으로 교체:
```css
.heroButton {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
```

파일 맨 아래(`.heroButtonSelected` 블록 다음)에 추가:
```css

.heroIcon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.heroIconFallback {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--surface);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
  flex-shrink: 0;
}

.heroName {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.archetypeGroup {
  margin-bottom: 10px;
}

.archetypeLabel {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 6px;
}
```

- [ ] **Step 3: 수동 검증**

```bash
# 터미널 1
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000
```
```bash
# 터미널 2
cd frontend && npm run dev
```
브라우저 http://localhost:3000 에서:
1. "상대 팀 픽"/"우리 팀 픽" 영웅 추가 버튼을 눌러 선택 목록을 열고, 역할
   탭(돌격/공격/지원) 안에 아키타입 소제목(예: 지원 안에 전술가/의무관)이
   나뉘어 보이는지 확인
2. 각 영웅 칩에 작은 원형 아이콘이 뜨는지 확인
3. 영웅 선택/해제가 기존처럼 정상 동작하는지 확인 (버튼 클릭 시 토글, 최대
   인원 도달 시 나머지 비활성화)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/HeroPickerPanel.tsx frontend/src/components/HeroPickerPanel.module.css
git commit -m "feat: group hero picker by role then archetype category with icons"
```

---

## Task 7: `ResultsPanel`에 큰 원형 아이콘 추가

**Files:**
- Modify: `frontend/src/components/ResultsPanel.tsx`
- Modify: `frontend/src/components/ResultsPanel.module.css`

**Interfaces:**
- Consumes: `HeroRecommendation.icon_url` (Task 5)

**참고:** 자동 테스트 인프라가 없어(기존 관례) 수동 검증으로 진행한다.

- [ ] **Step 1: `frontend/src/components/ResultsPanel.tsx`의 행 렌더링에 아이콘 추가**

`<div className={styles.rank}>{i + 1}</div>` 줄 바로 아래에 추가:
```tsx
            {rec.icon_url ? (
              <img
                src={rec.icon_url}
                alt=""
                className={`${styles.portrait} ${
                  i === 0 || rec.is_must_pick ? styles.portraitHighlight : ""
                }`}
              />
            ) : (
              <div
                className={`${styles.portraitFallback} ${
                  i === 0 || rec.is_must_pick ? styles.portraitHighlight : ""
                }`}
              >
                {rec.hero_name[0]}
              </div>
            )}
```

- [ ] **Step 2: `frontend/src/components/ResultsPanel.module.css`에 스타일 추가**

파일 맨 아래에 추가:
```css

.portrait {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 2px solid var(--border);
}

.portraitFallback {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--surface-2);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 800;
  color: var(--text-muted);
  flex-shrink: 0;
}

.portraitHighlight {
  border-color: var(--accent);
}
```

- [ ] **Step 3: 수동 검증**

(백엔드/프론트 둘 다 이미 떠 있다면 그대로 사용, 아니면 Task 6 Step 3처럼
두 서버를 띄운다.)
1. 추천을 받아 결과 화면에서 각 영웅에 64px 원형 아이콘이 보이는지 확인
2. 1위 또는 필수픽 항목의 아이콘 테두리가 주황색으로 강조되는지, 나머지는
   기본 테두리인지 확인
3. `icon_url`이 비어있는 경우(예: DB를 아직 재시딩 안 한 상태)에도 이름
   첫 글자가 든 원이 깨지지 않고 보이는지 확인

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ResultsPanel.tsx frontend/src/components/ResultsPanel.module.css
git commit -m "feat: show large hero portrait on recommendation result cards"
```
