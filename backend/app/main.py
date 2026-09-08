"""
오버워치 밴프준 보조 서비스 - FastAPI 앱 진입점.

스펙 문서(2026-09-07-overwatch-hero-recommender-design.md)의 아키텍처:
  [Next.js 프론트] -> [FastAPI 백엔드(이 앱)] -> [SQLite: 큐레이션된 시드 데이터]
"""
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routers import catalog, recommendations

logger = logging.getLogger("ow_backend")

app = FastAPI(
    title="오버워치 밴프준 보조 API",
    description="상대/우리 조합과 맵을 입력하면 빈 포지션에 어울리는 영웅을 추천한다.",
    version="0.1.0",
)

# 로컬 개발 단계라 일단 전체 허용. 프론트엔드 배포 도메인이 정해지면 좁혀야 함.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(catalog.router)
app.include_router(recommendations.router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # 스펙의 "백엔드 오류 -> 502" 처리. 라우터에서 명시적으로 던진 HTTPException(400 등)은
    # FastAPI가 알아서 처리하므로 여기까지 오지 않고, 진짜 예상 못 한 오류만 여기로 온다.
    logger.exception("Unhandled error while handling %s %s", request.method, request.url)
    return JSONResponse(
        status_code=502,
        content={"detail": "일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요."},
    )
