"""
같은 클라이언트(IP)가 짧은 시간에 과도하게 요청하는 걸 막는 간단한 인메모리
고정 윈도우(fixed window) 레이트리밋 미들웨어. 값은 app/config.py 참고.
"""
import time
from threading import Lock

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.config import RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_SECONDS

# 헬스체크는 배포 플랫폼이 짧은 주기로 호출하므로 제한에서 제외한다.
_EXEMPT_PATHS = {"/health"}


def _client_key(request: Request) -> str:
    # Railway 등 리버스 프록시 뒤에서는 request.client.host가 프록시 자신의
    # 주소가 되므로, 있으면 X-Forwarded-For의 첫 값(원 클라이언트)을 우선한다.
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int | None = None, window_seconds: int | None = None):
        super().__init__(app)
        self._max_requests = RATE_LIMIT_MAX_REQUESTS if max_requests is None else max_requests
        self._window_seconds = RATE_LIMIT_WINDOW_SECONDS if window_seconds is None else window_seconds
        self._lock = Lock()
        self._windows: dict[str, tuple[int, float]] = {}  # key -> (요청 수, 윈도우 시작 시각)

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path in _EXEMPT_PATHS:
            return await call_next(request)

        key = _client_key(request)
        now = time.monotonic()
        with self._lock:
            count, window_start = self._windows.get(key, (0, now))
            if now - window_start >= self._window_seconds:
                count, window_start = 0, now
            count += 1
            self._windows[key] = (count, window_start)
            retry_after = max(0, round(self._window_seconds - (now - window_start)))

        if count > self._max_requests:
            return JSONResponse(
                status_code=429,
                content={"detail": "요청이 너무 많아요. 잠시 후 다시 시도해주세요."},
                headers={"Retry-After": str(retry_after)},
            )
        return await call_next(request)
