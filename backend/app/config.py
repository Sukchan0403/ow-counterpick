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

# 하드카운터 가중치 불변식(스펙 "점수 계산 로직"의 "가중치 튜닝 제약" 참고):
# WEIGHT_COUNTER 1건 값은 다른 모든 보너스의 최댓값 합(시너지 최대 4명 ×
# WEIGHT_SYNERGY + WEIGHT_MAP_STRONG)보다 항상 커야 한다. 지금 값 기준
# 4*10+15=55이므로 60으로 설정 — 이 상수들을 조정할 때마다 이 부등식을 다시 확인할 것.
WEIGHT_COUNTER = 60  # 카운터하는 상대 영웅 1명당
WEIGHT_SYNERGY = 10  # 시너지 좋은 아군 영웅 1명당
WEIGHT_MAP_STRONG = 15  # 맵 평가 "강함"
WEIGHT_MAP_WEAK = -15  # 맵 평가 "약함"
# 맵 평가 데이터가 없거나 "보통"이면 0 (중립) — 스펙의 에러 처리 표 참고

# 총점(raw score, 이론상 상한 없음)을 0~100 표시용 점수로 바꿀 때 쓰는 기준선.
# percentage = round(PERCENTAGE_BASELINE + 50 * tanh(raw_score / PERCENTAGE_SCALE))
# 50이 공식의 절반 지점 상수라 PERCENTAGE_SCALE만 튜닝 대상이고 이 값 자체는
# 바꾸지 않는다.
PERCENTAGE_BASELINE = 50

# tanh 포화 곡선의 스케일 상수. 하드 clamp(50+raw_score, 0, 100)는 점수가 높은
# 후보끼리 100%로 뭉개져 변별력이 사라지는 문제가 있어 교체했다. WEIGHT_COUNTER와
# 같은 값으로 잡아, 카운터 1건만 있어도 강하게(약 88%) 오르되 100%로 즉시
# 포화되지는 않도록 함.
PERCENTAGE_SCALE = 60

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
