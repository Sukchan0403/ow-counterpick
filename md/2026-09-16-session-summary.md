# 작업 정리 — 2026-09-16

이 세션에서 Claude Code와 함께 진행한 작업 기록. `md/` 폴더는 앞으로도 이런 세션별
정리 문서를 모아두는 용도로 사용.

## 1. API 명세서 작성 & 제출

- 설계 문서(`docs/superpowers/specs/2026-09-07-...design.md`)를 실제 백엔드 구현
  (`models.py`/`scoring.py`/`config.py`/`tests/`)과 대조해 `docs/API명세서.md`를
  독립 문서로 작성
- `.claude/skills/conventional-commits/` 스킬 등록 (커밋 메시지를
  `type(scope): subject` 형식으로 통일)
- `docs/api-spec` 브랜치 → PR #3 생성 → 저장소 링크 포함 댓글 작성 → 머지 완료

## 2. PR #1·#2 코드 리뷰 및 수정

- **PR #1** (`worktree-scoring-improvements` — 결측치 3단 상태/하드카운터 가중치/
  percentage 포화 곡선): 미러 픽 자기참조 `data_gaps` 버그, 감사 스크립트 시너지
  방향성 누락, README 마이그레이션 설명 오류 등 7건 수정 후 커밋
- **PR #2** (`worktree-ui-hero-images-archetype` — 영웅 이미지·아키타입 카테고리):
  `HeroAvatar` 공용 컴포넌트 추출(onError 폴백 포함), `HeroOut` 기본값 불일치,
  `seed_db.py` 무결성 체크가 경고만 하고 안 막던 문제 등 4건 수정 후 커밋
- 두 PR 모두 (다른 세션에 의해) `master`에 머지 완료

## 3. 디바(D.Va) 매치업 데이터 변환 — 적용 대기 중

- 사용자가 준 1~5점 척도의 상대/아군/맵 평가 데이터를 카운터/시너지 관계 +
  맵 강함·보통·약함 스키마로 변환
- 결과물: 스크래치패드의 `dva_counter_relations.json`(35건),
  `dva_synergy_relations.json`(7건), `dva_map_hero_ratings.json`(30건)
- **아직 `seed-data/`에 적용 안 함** — 기존 손큐레이션 데이터와 겹치는 부분 있음
  (라인하르트/오리사/자리야 중복, 오아시스 강함/약함 모순) — 적용 시점에 재확인 필요

## 4. 중국어(간체·번체) 다국어 지원 완료

- 기존 ko/en/ja 3개 언어에 `zh-cn`/`zh-tw` 추가 (백엔드 `Lang` 리터럴,
  `repository.py` 언어별 컬럼 접미사, `scoring.py` 중국어 메시지, 프론트
  `/zh-cn`·`/zh-tw` 라우트, `i18n.ts` 전체 사전, 언어 스위처, hreflang, sitemap)
- 백엔드 63개 테스트 통과, 프론트 `tsc` 클린, 로컬 서버 띄워 실제 응답까지 확인
- 커밋 2개(`feat(i18n): ...`, `docs: ...`)로 나눠 `master`에 push
- **프로덕션(Railway)에도 이미 반영 확인됨** — `/zh-cn`, `/zh-tw` 200 응답,
  블리자드 공식 지역별 게임명("守望先锋" vs "鬥陣特攻")까지 정확히 반영

## 5. 기타

- 메인 체크아웃의 깨져 있던 `backend/.venv` 재생성
- `npm run dev`가 자동 생성한 불필요한 `AGENTS.md`/`CLAUDE.md` 삭제
- 로컬 테스트용 백엔드(8000)/프론트(3000) 서버 종료 완료

## 현재 프로젝트 문서 목록

| 문서 | 위치 |
|---|---|
| 프로젝트 소개 | `README.md` |
| API 명세서 | `docs/API명세서.md` |
| 설계 문서(원본 스펙, 누적 의사결정) | `docs/superpowers/specs/2026-09-07-overwatch-hero-recommender-design.md` |
| 스코어링 개선 계획(PR #1 원본) | `docs/superpowers/plans/2026-09-08-scoring-improvements.md` |
| UI 리디자인 계획(PR #2 원본) | `docs/superpowers/plans/2026-09-08-ui-hero-images-archetype-categories.md` |
| 백엔드/프론트엔드/시드데이터 README | `backend/README.md`, `frontend/README.md`, `seed-data/README.md` |

## 다음에 이어서 할 만한 것

- 디바 변환 데이터를 기존 데이터와 조율해 `seed-data/`에 실제 반영
- 다른 세션(iTerm)이 진행 중이던 작업들과의 동기화 상태 재확인

---

# 추가 작업 — 2026-09-17

로드맵 남은 항목(문서 목록 정리 이후 논의된 것) 중 3개 진행: 필수픽 임계치
검증, 프론트엔드 자동 테스트, 드래프트 시뮬레이션 모드(요구사항 확인 단계).

## 3. `MUST_PICK_PERCENTAGE_THRESHOLD`(90) 실증 검증 — 완료, 변경 없음

- `backend/scripts/audit_must_pick_distribution.py`를 54종 전체 로스터로 재실행
- 카운터 단독 88% / 시너지 단독 58% / 카운터+시너지 결합 91% — "단일 관계만으로는
  안 되고 결합 신호가 있어야 발동"하는 config.py 주석의 의도와 정확히 일치
- **결론: 임계치 조정 불필요.** 다만 감사 스크립트가 "카운터+맵 강함" 등 다른 조합은
  테스트 안 함 — 커버리지 확장은 향후 과제로 남김

## 2. 프론트엔드 자동 테스트 — 완료 (0개 → 58개)

- Vitest + React Testing Library + jsdom 신규 설치 (`@types/node`를 vitest 5
  peer 요구사항에 맞춰 `^20` → `^24`로 상향)
- 테스트 대상: `HeroAvatar`, `SharedHeroGrid`, `MapPickerModal`, `ResultsPanel`,
  `ErrorScreen`, `ThemeToggle`, `LanguageSwitcher`, `lib/i18n.ts`, `lib/api.ts`,
  그리고 `HomeClient`(카탈로그 로딩/에러/재시도, 자동 제출, 검증 에러 vs. 서버
  에러 구분, 뒤로가기) 통합 테스트까지
- **테스트 작성 중 실제 버그 1건 발견 및 수정**: `api.ts`의 400/422 에러 처리가
  응답 바디에 `detail` 필드가 아예 없을 때(`{}`) 빈 문자열 에러 메시지를 던지던
  문제 — `body.detail`이 있을 때만 덮어쓰도록 수정
- `.github/workflows/frontend-tests.yml` 신규 추가 (백엔드처럼 push/PR 시
  타입체크 + 테스트 자동 실행)
- README 로드맵 체크 완료로 갱신

## 4. 드래프트 시뮬레이션 모드 — 설계만 완료 (구현 안 함, 요청대로)

- 사용자 선택: "양 팀 5명 완성 상태만 입력해 종합 평가"(밴/픽 단계별 시뮬레이션
  아님), 진행 여부는 "설계만"
- `design.md`에 새 섹션 추가: 입력(상대·우리 5명씩+맵), 점수 계산은 **새 로직
  없이 기존 `score_candidates()`를 후보 1명(`candidates=[X]`)·나머지 4명을
  `ally_ids`로 넘겨 5번 호출**하는 방식으로 재사용 가능하다는 핵심 통찰 정리,
  신규 API 제안(`POST /api/team-evaluation`), 미확정 목록(종합 점수 집계 방식,
  약한 포지션 강조 UI, 밴 단계 포함 여부, 프론트 목업) 명시
- 기존 "향후 확장"의 틀린 메모("양 팀 6명씩")를 5명으로 정정
- 코드 변경 없음 — 설계 문서만 커밋·push (`2186933`)
