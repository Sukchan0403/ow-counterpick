"""
같은 클라이언트(IP)가 짧은 시간에 과도하게 요청하는 걸 막는 간단한 인메모리
고정 윈도우(fixed window) 레이트리밋 미들웨어. 값은 app/config.py 참고.
"""
import time
from threading import Lock

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.config import (
    RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_TRUSTED_PROXY_HOPS,
    RATE_LIMIT_WINDOW_SECONDS,
)

# 헬스체크는 배포 플랫폼이 짧은 주기로 호출하므로 제한에서 제외한다.
_EXEMPT_PATHS = {"/health"}


def _client_key(request: Request, trusted_hops: int) -> str:
    # Railway 등 리버스 프록시 뒤에서는 request.client.host가 프록시 자신의
    # 주소가 되므로 X-Forwarded-For를 봐야 한다. 단, 첫 값은 클라이언트가 임의로
    # 채워 보낼 수 있어(요청마다 바꾸면 제한 우회), 신뢰 프록시가 덧붙인 오른쪽
    # 끝에서 trusted_hops번째 값을 쓴다. 값이 그보다 적으면 프록시를 거치지 않은
    # 요청이므로 헤더를 무시하고 접속 주소를 쓴다.
    forwarded_for = request.headers.get("x-forwarded-for")
    if trusted_hops > 0 and forwarded_for:
        hops = [part.strip() for part in forwarded_for.split(",") if part.strip()]
        if len(hops) >= trusted_hops:
            return hops[-trusted_hops]
    return request.client.host if request.client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        max_requests: int | None = None,
        window_seconds: int | None = None,
        trusted_proxy_hops: int | None = None,
    ):
        super().__init__(app)
        self._max_requests = RATE_LIMIT_MAX_REQUESTS if max_requests is None else max_requests
        self._window_seconds = RATE_LIMIT_WINDOW_SECONDS if window_seconds is None else window_seconds
        self._trusted_proxy_hops = (
            RATE_LIMIT_TRUSTED_PROXY_HOPS if trusted_proxy_hops is None else trusted_proxy_hops
        )
        self._lock = Lock()
        self._windows: dict[str, tuple[int, float]] = {}  # key -> (요청 수, 윈도우 시작 시각)
        self._last_sweep = time.monotonic()

    def _sweep_expired(self, now: float) -> None:
        # 만료된 윈도우를 지우지 않으면 한 번 왔다 간 클라이언트 키가 계속 쌓여
        # 메모리가 무한히 늘어난다. 윈도우 길이마다 한 번만 훑어 비용을 분산한다.
        # (호출자가 self._lock을 잡고 있어야 함)
        if now - self._last_sweep < self._window_seconds:
            return
        self._windows = {
            key: entry
            for key, entry in self._windows.items()
            if now - entry[1] < self._window_seconds
        }
        self._last_sweep = now

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path in _EXEMPT_PATHS:
            return await call_next(request)

        key = _client_key(request, self._trusted_proxy_hops)
        now = time.monotonic()
        with self._lock:
            self._sweep_expired(now)
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
