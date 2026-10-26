"""
Vercel 배포용 진입점(저장소 루트 pyproject.toml의 tool.vercel.entrypoint).

앱 코드는 backend/를 기준으로 `from app.config import ...`처럼 import하는데,
Vercel은 저장소 루트에서 이 파일을 backend.vercel_app 모듈로 불러온다.
그래서 backend/를 import 경로에 넣은 뒤 앱을 그대로 다시 내보내기만 한다.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.main import app  # noqa: E402

__all__ = ["app"]
