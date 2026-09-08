# 오버워치 밴프준 보조 — 프론트엔드 (Next.js)

스펙 문서(`docs/superpowers/specs/2026-09-07-overwatch-hero-recommender-design.md`)의
아키텍처대로 `../backend`(FastAPI)를 호출하는 실제 동작하는 프론트엔드.

```
[이 프로젝트: Next.js] -> [../backend: FastAPI] -> [../seed-data/overwatch.db]
```

## 실행 방법

```bash
# 1) 먼저 backend를 띄운다 (backend/README.md 참고)
cd ../backend
source .venv/bin/activate
uvicorn app.main:app --reload   # http://127.0.0.1:8000

# 2) 프론트엔드
cd ../frontend
npm install
npm run dev                     # http://localhost:3000
```

백엔드 주소가 `http://127.0.0.1:8000`이 아니면 `.env.local.example`을 `.env.local`로
복사해서 `NEXT_PUBLIC_API_BASE_URL` 값을 바꿔주면 된다.

## 검증한 것

Claude 클라우드 샌드박스에서 Playwright로 실제 브라우저를 띄워 다음을 확인했다:

- 상대 팀 픽(겐지) + 우리 팀 픽(라인하르트) + 힐러 빈 포지션 + 아이헨발데 맵을
  실제로 클릭해서 입력 → 백엔드가 계산한 순위(아나 1위, 겐지 카운터 근거 포함)가
  화면에 정확히 렌더링됨
- 빈 포지션/맵을 안 고르고 제출 → 인라인 검증 에러 문구 정상 표시
- `npm run lint`, `npx tsc --noEmit`, `npm run build` 전부 에러 없이 통과
- 브라우저 콘솔 에러 없음

`npm install` 자체는 검증 환경(클라우드 샌드박스)에서 한 것이라, 맥북에서
다시 `npm install`을 실행해야 로컬 `node_modules`가 만들어진다.

## 구조

- `src/lib/types.ts` — 백엔드 Pydantic 모델과 1:1 대응하는 타입
- `src/lib/api.ts` — 백엔드 호출 (성공/검증 에러/서버 에러를 구분해서 throw)
- `src/components/` — 팀 픽 선택(`HeroPickerPanel`), 포지션 선택(`RoleSelectPanel`),
  맵 선택 모달(`MapPickerModal`), 결과 리스트(`ResultsPanel`), 에러 화면(`ErrorScreen`)
- `src/app/page.tsx` — 위 컴포넌트들을 엮는 메인(유일한) 페이지. 폼 입력 → 제출 →
  결과/에러 세 가지 상태를 하나의 페이지에서 전환하는 방식 (실전 밴프준 중 빠르게
  다시 입력해볼 수 있도록 페이지 이동 없이 처리)

## 목업이랑 다른 점 (알아둘 것)

Claude Design 캔버스 목업(6개 화면, OWTICS.GG 스타일)의 색상 토큰·레이아웃 구조는
최대한 재사용했지만, 지도 배경 그라디언트나 세부 아이콘 등 시각적으로 완전히
동일하지는 않다 — 실제로 동작하는 걸 우선으로 빠르게 붙인 결과물이라, 디자인
디테일을 더 맞추고 싶으면 이후에 다듬으면 된다.

## 다음 단계 후보

- 목업의 헤더 네비게이션(드래프트 시뮬레이션 탭 등) 추가
- 지금은 새로고침하면 입력이 다 날아감 — 필요하면 로컬스토리지에 임시 저장
- 배포 (Vercel 등 — 이때 `NEXT_PUBLIC_API_BASE_URL`을 배포된 백엔드 주소로 설정)
