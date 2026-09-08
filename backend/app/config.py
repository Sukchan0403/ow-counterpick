"""
설정값. 스펙 문서(2026-09-07-overwatch-hero-recommender-design.md)의
"핵심 제약" 섹션대로 서비스 런타임에는 외부 API를 호출하지 않고,
시드 데이터로 미리 채워진 SQLite 파일만 조회한다.

DB 경로는 환경변수 OW_DB_PATH로 override 가능. 기본값은 이 저장소의
../seed-data/overwatch.db (ch03_2/seed-data/seed_db.py가 만들어내는 그 파일)를
가리킨다 — 시드 데이터와 앱이 같은 DB 파일을 공유한다.
"""
import os
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent

DEFAULT_DB_PATH = BACKEND_DIR.parent / "seed-data" / "overwatch.db"

DB_PATH = Path(os.environ.get("OW_DB_PATH", str(DEFAULT_DB_PATH)))

# 점수 계산 가중치. 스펙은 "카운터 점수 = 카운터하는 상대 영웅 수 × 가중치" 식으로
# 계산법만 정하고 구체적인 가중치 값은 정하지 않았음 — 아래는 초기 튜닝값이며
# 실제 사용해보면서 조정하면 된다.
WEIGHT_COUNTER = 15  # 카운터하는 상대 영웅 1명당
WEIGHT_SYNERGY = 10  # 시너지 좋은 아군 영웅 1명당
WEIGHT_MAP_STRONG = 15  # 맵 평가 "강함"
WEIGHT_MAP_WEAK = -15  # 맵 평가 "약함"
# 맵 평가 데이터가 없거나 "보통"이면 0 (중립) — 스펙의 에러 처리 표 참고

# 총점(raw score, 이론상 상한 없음)을 0~100% 표시용 점수로 바꿀 때 쓰는 기준선.
# percentage = clamp(50 + raw_score, 0, 100)
PERCENTAGE_BASELINE = 50

# 목업(Result.dc.html)의 "필수픽" 배지 기준. percentage가 이 값 이상이면 표시.
# 근거 데이터가 굉장히 잘 들어맞는 상위권 픽에만 붙는 걸 의도한 임의 튜닝값.
MUST_PICK_PERCENTAGE_THRESHOLD = 90

# 목업(MapPicker.dc.html)의 "데이터 풍부"/"데이터 보강 중" 표시 기준.
# 해당 맵에 큐레이션된 map_hero_ratings row 수가 이 값 이상이면 "rich".
MAP_DATA_RICH_THRESHOLD = 3

# 목업(Main.dc.html) 헤더의 "시즌 4 시드 데이터 · v0.3" 배지용 값.
# 시드 데이터를 갱신할 때마다 이 값도 같이 올려주면 됨 — DB에 저장하는 값이
# 아니라 배포 시점의 시드 데이터 버전을 코드에서 직접 표기하는 정적 메타데이터.
SEED_SEASON = "시즌 4"
SEED_DATA_VERSION = "v0.3"
