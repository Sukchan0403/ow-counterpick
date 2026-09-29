"""RateLimitMiddleware 단독 테스트. tests/conftest.py의 client fixture는 모든
테스트가 같은 앱 인스턴스를 공유해 요청이 누적되므로(레이트리밋 window가
넉넉하게 풀려있음), 여기서는 아주 작은 max_requests로 별도의 최소 앱을 만들어
429 동작 자체를 검증한다."""
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.rate_limit import RateLimitMiddleware


def _make_client(max_requests: int, window_seconds: int = 60) -> TestClient:
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, max_requests=max_requests, window_seconds=window_seconds)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/ping")
    def ping():
        return {"ok": True}

    return TestClient(app)


def test_requests_within_limit_pass_through():
    client = _make_client(max_requests=3)
    for _ in range(3):
        assert client.get("/api/ping").status_code == 200


def test_requests_exceeding_limit_get_429_with_retry_after():
    client = _make_client(max_requests=2)
    assert client.get("/api/ping").status_code == 200
    assert client.get("/api/ping").status_code == 200

    res = client.get("/api/ping")
    assert res.status_code == 429
    assert res.json()["detail"]
    assert "Retry-After" in res.headers


def test_health_endpoint_is_exempt_from_rate_limit():
    client = _make_client(max_requests=1)
    assert client.get("/health").status_code == 200
    assert client.get("/health").status_code == 200
    assert client.get("/health").status_code == 200


def test_different_clients_have_independent_limits():
    client = _make_client(max_requests=1)
    assert client.get("/api/ping", headers={"X-Forwarded-For": "1.1.1.1"}).status_code == 200
    # 다른 클라이언트(IP)는 별도 카운터라 영향받지 않아야 함
    assert client.get("/api/ping", headers={"X-Forwarded-For": "2.2.2.2"}).status_code == 200
    # 같은 클라이언트는 한도 초과
    assert client.get("/api/ping", headers={"X-Forwarded-For": "1.1.1.1"}).status_code == 429
