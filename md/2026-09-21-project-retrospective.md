# ow-counterpick 개발 회고록 — 트러블슈팅 중심

- 프로젝트: 오버워치 밴프준 보조 (ow-counterpick) — 개인 포트폴리오
- 기간: 2026-09-08 ~ 2026-09-21 (약 2주)
- 저장소: https://github.com/Sukchan0403/ow-counterpick
- 배포: https://ow-counterpick-frontend-production.up.railway.app
- 작성 방식: 커밋 로그·PR·Claude Code와의 대화 기록을 원재료로 재구성.
  요약이 아니라 **문제가 발생한 순간의 증거(에러 메시지 원문)를 그대로** 남긴다.

## 숫자로 보는 진행 상황

| 항목 | 시작 | 종료 (2026-09-21) |
|---|---|---|
| 영웅 수 | 5 (탱커만) | 54종 전체 로스터 |
| 맵 수 | 8 | 32 (6개 모드 전부) |
| 백엔드 테스트 | 24개 | 63개 |
| 프론트엔드 테스트 | **0개** | **58개** |
| 지원 언어 | 1 (한국어) | 5 (한국어/영어/일본어/중국어 간체·번체) |
| 병합된 PR | 0 | 3건 (#1, #2, #3) |
| 배포 상태 | 없음 | Railway 실배포 + Docker 컨테이너화 |
| CI | 없음 | GitHub Actions 2개(backend/frontend), 현재 모두 통과 |
| 점수 정규화 공식 | `clamp(50+총점, 0, 100)` | `50 + 50·tanh(총점/60)` |
| 필수픽 임계치 감사 결과 | (측정 안 함) | 카운터 단독 88% / 시너지 단독 58% / 결합 91% |

## 트러블슈팅 로그

### 1. 미러 픽 시 자기참조 `data_gaps` 버그

- **발생 상황**: PR #1(결측치 3단 상태 기능) 코드 리뷰 중, 상대 팀이 이미 픽한 영웅을 우리 팀도 후보로 픽할 수 있는 "미러 픽" 시나리오를 8개 관점(reuse/efficiency/line-by-line 등)으로 병렬 리뷰하다가 발견.
- **증상**: 후보 영웅이 상대 팀에도 동시에 존재할 때, `data_gaps`에 `"상대 라인하르트와의 카운터 관계 미검토"`처럼 **자기 자신과의 관계 미검토** 문구가 붙는 논리적 모순.
- **원인**: `backend/app/scoring.py`의 결측치 판정 루프가 `enemy_id == cid`(후보 자신)인 경우를 걸러내지 않음.
- **해결**: 한 줄 가드 추가.
  ```python
  if enemy_id == cid:
      # 미러 픽 허용 규칙상 후보가 상대 팀에도 있을 수 있음 — 자기 자신과의
      # "카운터 관계"는 애초에 성립하지 않으므로 결측치로 취급하지 않는다.
      continue
  ```
- **검증**: 수정 전/후 직접 함수 호출로 확인 — 수정 후 `data_gaps: []` (빈 배열) 확인.
- **커밋**: `b930252`

### 2. 감사 스크립트가 실제 스코어링 로직과 다르게 짜여 있었음

- **증상**: `MUST_PICK_PERCENTAGE_THRESHOLD` 실증 검증용 스크립트가 "카운터+시너지 결합" 표본을 셀 때 `synergy_relations`의 `hero_id` 컬럼만 확인.
- **원인**: `synergy_relations`는 한 방향으로만 저장되는데(예: A→B로만 저장), 실제 프로덕션 코드(`score_candidates`)는 양방향(`hero_id`/`synergy_hero_id` 둘 다)을 확인하도록 짜여 있었음 — **감사 스크립트만 그 규칙을 안 따라서, 감사 스크립트가 검증하려는 대상(실제 로직)과 다른 로직으로 검증하고 있던 상황.**
- **교훈**: 검증 스크립트를 작성할 때 원본 로직의 가정(여기선 "단방향 저장, 조회는 양방향")을 그대로 복제해야 한다 — 아니면 "검증했다"는 착각만 남고 실제로는 다른 걸 잰다.
- **커밋**: `9dfe158`

### 3. 문서(API 명세서)를 잘못된 방식으로 브랜치에 추가해 add/add 충돌 발생 — 내 실수

- **발생 순간**: PR #1/#2 리뷰 수정을 마치고 "이제 머지해도 되냐"는 질문에 확인하려고 `gh pr view --json mergeable`을 돌렸더니:
  ```
  PR #1: mergeable: CONFLICTING, mergeStateStatus: DIRTY
  PR #2: mergeable: MERGEABLE
  ```
- **원인 재현**:
  ```
  자동 병합: docs/API명세서.md
  충돌 (추가/추가): docs/API명세서.md에 병합 충돌
  ```
  master에 이미 있던 `docs/API명세서.md`(PR #3로 먼저 병합됨)를, PR #1 브랜치에도 **완전히 새 파일인 것처럼 복사해서 커밋**해버려서 git 입장에서는 "두 브랜치가 같은 경로를 각자 독립적으로 추가"한 꼴이 됨 — 공통 조상이 없어 자동 병합이 불가능한 상태.
- **잘한 점**: 사용자가 "확인만 해"라고 정정해준 순간, 이미 시작한 병합 작업을 즉시 `git merge --abort`로 되돌리고 브랜치를 원상복구함 — 확인 요청과 실제 수정 작업을 구분하지 못한 게 문제였지만, 최소한 되돌리기는 깔끔했음.
- **해결**: 나중에 실제로 해당 브랜치에 `git merge origin/master`를 실행해 충돌을 직접 겪고, `git checkout --ours`로 브랜치의 최신 버전을 채택해 해결.
- **교훈**: 다른 브랜치에 이미 존재하는 파일을 "복사"해서 새 브랜치에 넣을 땐, 항상 git이 그걸 "새 파일 추가"로 인식한다는 걸 먼저 고려해야 한다.

### 4. 메인 체크아웃의 `backend/.venv`가 조용히 깨져 있었음

- **증상**:
  ```
  /Library/Developer/CommandLineTools/usr/bin/python3: No module named pytest
  ```
  `source .venv/bin/activate` 후 `which python3`은 venv 경로를 정확히 가리키는데도, `python3 -m pytest`는 계속 시스템 파이썬으로 떨어짐.
- **원인 규명**: `.venv/bin/python3`을 직접 `readlink`로 까보니:
  ```
  .venv/bin/python3 -> /usr/bin/python3
  ```
  venv가 pyenv 파이썬이 아니라 **시스템 CommandLineTools 파이썬으로 잘못 생성**돼 있었음 (다른 워크트리의 `.venv`는 정상이었음 — 이 메인 체크아웃의 `.venv`만 문제).
- **해결**: `.venv`는 `.gitignore` 대상(빌드 산출물)임을 확인 후 통째로 삭제하고 pyenv 파이썬으로 재생성.
- **교훈**: "venv activate 했는데 이상하다" 싶으면 `which`보다 **`readlink`로 실제 심볼릭 링크 대상을 직접 확인**하는 게 더 빠르다.

### 5. 테스트를 쓰다가 실제 프로덕션 버그를 잡음 — 빈 에러 메시지

- **상황**: 프론트엔드 테스트 0개 → 처음부터 작성하던 중, `api.ts`의 400/422 에러 처리에 대한 테스트를 쓰다가 발견.
- **증상(테스트 실패 원문)**:
  ```
  AssertionError: expected [Function] to throw error including '입력값을 확인해주세요.'
  but got ''
  ```
- **원인**: 에러 응답 바디가 `{}`처럼 `detail` 필드 자체가 없을 때, `JSON.stringify(body.detail)`이 `JSON.stringify(undefined)` → 실제 `undefined` 값을 반환 → `new ApiValidationError(undefined)`가 메시지를 빈 문자열로 만듦. 원래 의도한 폴백 문구(`"입력값을 확인해주세요."`)는 `res.json()` 자체가 실패할 때만 살아남는 구조였음.
- **해결**: `body?.detail !== undefined`일 때만 덮어쓰도록 조건 추가.
- **의미**: "테스트가 없어서 버그인지도 몰랐던" 사례 — 테스트 커버리지 확충 작업 자체가 목적이었는데, 부산물로 실제 사용자가 겪었을 수도 있는(에러 상황에서 빈 메시지만 뜨는) 버그를 잡음.
- **커밋**: `444a646`

### 6. CI가 추가된 첫날부터 계속 실패하고 있었는데 며칠간 못 알아챔

- **발생 배경**: `frontend-tests.yml`을 만들 때 로컬에서 `npx tsc --noEmit`을 여러 번 돌려 전부 통과하는 걸 확인하고 커밋 → CI에도 그대로 넣음.
- **뒤늦게 발견한 증상**: 며칠 뒤 "여기서 뭘 더 해야 하냐"는 질문에 답하려고 `gh run list`를 돌려보다가:
  ```
  completed  failure  ...  frontend-tests  master  push
  completed  failure  ...  frontend-tests  master  push
  ```
  실제 실패 로그:
  ```
  ##[error]src/app/layout.tsx(62,50): error TS2304: Cannot find name 'LayoutProps'.
  ##[error]Process completed with exit code 2.
  ```
- **원인**: `LayoutProps<"/">`는 Next.js가 `next dev`/`next build` 실행 시 `.next/types/`에 **자동 생성**하는 타입. 로컬에선 이미 여러 번 `npm run dev`/`npm run build`를 돌려서 `.next/`가 항상 존재했기 때문에 문제를 못 봤지만, **CI는 매번 완전히 새로 체크아웃**해서 `.next/`가 없는 상태로 `tsc --noEmit`부터 실행 → 항상 실패.
- **재현 및 검증**:
  ```bash
  rm -rf .next
  npx tsc --noEmit   # 실패 재현: Cannot find name 'LayoutProps'
  npx next typegen   # ✓ Types generated successfully
  npx tsc --noEmit   # exit 0
  ```
- **해결**: CI 워크플로에 `npx next typegen` 스텝을 타입체크 전에 추가.
- **교훈(가장 뼈아픈 것)**: "로컬에서 통과하는 걸 확인했다"는 게 "CI에서도 통과한다"는 보장이 아니다. **CI를 추가한 직후 실제로 그 워크플로가 성공했는지 직접 확인하지 않은 게 근본 원인** — `git push` 후 `gh run list`로 확인하는 걸 습관화해야 했다. 이번엔 며칠 뒤 다른 목적으로 우연히 발견했지만, 운이 나빴으면 훨씬 더 오래 방치될 뻔했다.
- **커밋**: `57368aa`

### 7. 여러 세션이 같은 저장소를 동시에 작업하며 생긴 혼란

- **상황**: 이 프로젝트는 한 터미널(iTerm)과 이 Claude Code 대화가 **동시에 같은 로컬 저장소**를 건드리는 구간이 여러 번 있었다.
- **구체적 증상**: `design.md`를 읽었는데 몇 분 뒤 다시 읽으니 145줄짜리 문서가 526줄로 바뀌어 있거나, `git status`에 내가 손대지 않은 `heroes.json`/`overwatch.db`가 수정된 상태로 떠 있는 등, "방금 읽은 파일이 다음에 또 읽으니 달라져 있다"는 상황이 반복.
- **대응**: 매번 `git log`/`git diff`/`git fetch`로 실제 상태를 재확인하고, 다른 세션이 작업 중인 파일(`counter_relations.json` 등)은 건드리지 않고 대기 — 예를 들어 디바(D.Va) 매치업 데이터는 변환까지 다 해놓고도 "다른 세션이 끝난 뒤에" 적용하기로 미룸(실제로 나중에 다른 세션이 더 정교한 버전으로 직접 반영함 — 커밋 `df36c1c`, `2adefbb` 등).
- **교훈**: 공유 git 저장소를 여러 에이전트/세션이 동시에 건드릴 땐, "내가 마지막으로 읽은 상태"를 신뢰하지 말고 액션 직전에 항상 재확인해야 한다. 특히 `git stash`는 다른 세션과 스택을 공유하므로 맨 stash pop 대신 태그를 붙인 `stash apply`로만 다뤘다.

## 실패와 삽질 (정직하게)

- **PR 머지 확인 요청을 실제 머지 시도로 착각**: 사용자가 "머지해도 되냐"고 물었을 뿐인데 실제로 로컬에서 병합을 시작해버림 → "아니 확인만 해"로 제지당함. 확인(read-only) 요청과 실행 요청을 헷갈린 전형적 사례.
- **테스트 작성 중 반복적으로 저지른 실수**: `HomeClient` 통합 테스트에서 우리 팀 인원을 3명만 뽑아놓고(실제로는 4명 필요) "왜 자동 제출이 안 되지"로 한참 헤맴 — `postRecommendations`가 0번 호출됐다는 assertion 실패 메시지를 보고서야 팀 인원 계산 실수를 발견. 같은 종류로, "Sup1"이라는 텍스트가 화면에 두 군데(피커 그리드+결과 화면) 다 존재해서 `findByText("Sup1")`가 결과 화면이 뜨기도 전에 그리드 쪽에서 먼저 매칭돼버려 테스트가 거짓으로 통과할 뻔한 경우도 있었음(성공 판정 기준을 `recommendationScore` 텍스트로 바꿔 해결).
- **커밋 하나에 서로 다른 성격의 수정 3개를 섞음**: PR #1 리뷰 수정 중 `scoring.py`에 버그 수정+상수화+효율화 3가지를 한 번에 커밋해놓고 메시지는 하나만 설명 → 직접 만든 `conventional-commits` 스킬 규칙("타입 다르면 커밋 나누기")을 스스로 어긴 걸 알아채고 메시지를 다시 정정.

## 배운 점 요약

1. **로컬 통과 ≠ CI 통과.** CI를 추가했다면 반드시 그 실행 결과를 직접 확인할 것.
2. **테스트는 기능 검증 도구이기 전에 버그 발견 도구다.** "테스트가 없어서 몰랐던 버그"가 실제로 나왔다.
3. **다른 파일에 이미 있는 걸 복사해 넣을 땐 git 히스토리 관점에서 한 번 더 생각.** add/add 충돌은 예방 가능했다.
4. **공유 환경에서의 작업은 "마지막으로 본 상태"를 신뢰하지 않는 습관이 필요하다.**
5. **확인(read-only) 요청과 실행 요청은 구분해서 처리해야 한다.**
