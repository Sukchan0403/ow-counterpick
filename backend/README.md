# 오버워치 밴프준 보조 — 백엔드 (FastAPI)

스펙 문서(`docs/superpowers/specs/2026-09-07-overwatch-hero-recommender-design.md`)의
"실시간 밴프준 보조" MVP를 구현한 첫 프로토타입. 아키텍처는 스펙 그대로:

```
[Next.js 프론트] -> [FastAPI 백엔드(이 프로젝트)] -> [SQLite: ../seed-data/overwatch.db]
```

서비스 런타임에는 외부 API 호출이 전혀 없다 — `../seed-data/`에 이미 시딩된
`overwatch.db`만 조회한다.

## 실행 방법

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate      # Windows는 .venv\Scripts\activate
pip install -r requirements.txt

# ../seed-data/overwatch.db가 없다면 먼저 시드부터:
#   cd ../seed-data && python3 seed_db.py && cd ../backend

uvicorn app.main:app --reload --port 8000
```

브라우저에서 http://127.0.0.1:8000/docs 열면 Swagger UI로 바로 테스트해볼 수 있음.

## 테스트

```bash
source .venv/bin/activate
pytest -v
```

- `tests/test_scoring.py`: 점수 계산 로직만 순수하게 검증 (DB 없음)
- `tests/test_api.py`: 실제 라우트 테스트. `conftest.py`가 테스트 전용 작은 DB를
  임시 디렉토리에 만들어서 쓰기 때문에, 실제 시드 데이터(`../seed-data/overwatch.db`)와
  무관하게 항상 같은 결과로 검증된다.

**이 코드는 Claude 클라우드 샌드박스에서 실제로 pip install → pytest → uvicorn 기동 →
curl 요청까지 전부 실행해서 검증한 상태로 전달합니다** (14개 테스트 전부 통과,
실제 시드 DB로 정상 케이스/중립 케이스 curl 확인 완료).

## API

### `POST /api/recommendations`

```json
{
  "enemy_heroes": ["widowmaker", "genji"],
  "our_heroes": ["tracer"],
  "empty_position": "support",
  "map_id": "eichenwalde"
}
```

→ 상위 5개 후보를 `total_score` 내림차순으로 반환. 각 항목에
`score_breakdown`(counter/synergy/map 세부 점수)과 `reasons`(DB에 저장된 근거 문장
그대로)가 들어있다. 근거가 하나도 안 잡히면 `"일반적으로 무난한 영웅"`.

`enemy_heroes`/`our_heroes`를 둘 다 비워서 보내면(스펙의 에러 처리 표대로) 요청은
정상 처리되고 맵 점수만 반영되며, 응답의 `notice` 필드에 안내 문구가 채워진다.

### `GET /api/heroes`, `GET /api/maps`

프론트 입력 폼 채우는 용도.

## 점수 계산

스펙의 "점수 계산 로직" 그대로: 후보 영웅마다 카운터 점수 + 시너지 점수 + 맵
점수를 더한다. 가중치는 스펙에 구체적으로 명시돼 있지 않아서 `app/config.py`에
상수로 뒀다 — 실제로 써보면서 튜닝하면 된다.

- 카운터: 상대 팀 중 이 영웅이 카운터하는 영웅 1명당 +15
- 시너지: 우리 팀 중 이 영웅과 시너지 좋은 영웅 1명당 +10
- 맵: 강함 +15 / 약함 -15 / 데이터 없음(보통 포함) 0

`percentage = clamp(50 + total_score, 0, 100)` — 목업에서 쓰던 "%" 표시용 값이고,
실제 순위/필터링은 `total_score`(raw) 기준.

## 알아둘 것 / 다음 단계

- `synergy_relations`는 한 방향으로만 저장돼 있지만(예: `reinhardt→zarya`만 있고
  `zarya→reinhardt`는 없음) 실제로는 대칭 관계라, `repository.py`에서 양쪽 방향을
  다 조회하도록 처리해뒀다. `counter_relations`는 반대로 원래 방향성이 있는
  관계라 한쪽만 조회한다 (`seed-data/README.md` 참고).
- 아키텍처 결정 문서(`아키텍처-결정-근거생성방식.md`)에서 논의한 `confidence`/
  `source_context`/`comm_dependent` 필드는 아직 스키마에 없음 — 다음 단계에서
  DB 스키마와 이 코드에 같이 반영하면 됨.
- 인증/배포/CORS 세부 설정은 전혀 안 돼 있는 로컬 프로토타입 수준. `main.py`의
  CORS는 지금 전체 허용 상태.
