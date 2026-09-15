# 빌드 컨텍스트는 반드시 저장소 루트여야 한다 — seed-data/(큐레이션된 overwatch.db)를
# backend/와 같이 복사해야 하기 때문. docker-compose.yml이 이미 이렇게 설정돼 있고,
# 직접 빌드할 땐 저장소 루트에서:
#   docker build -f backend/Dockerfile -t ow-backend .
FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/app backend/app
# config.py의 DEFAULT_DB_PATH가 "backend/의 부모 디렉터리 안의 seed-data/"를
# 가리키므로, 컨테이너 안에서도 저장소와 동일한 상대 구조(/app/backend,
# /app/seed-data)를 유지해야 OW_DB_PATH를 따로 지정할 필요가 없다.
COPY seed-data/overwatch.db seed-data/overwatch.db

WORKDIR /app/backend

EXPOSE 8000
# 셸 형태로 실행해야 ${PORT}가 환경변수로 치환된다 — Railway/Render 등은 컨테이너가
# 자체 지정한 $PORT로 리슨하길 기대하고, 로컬 docker-compose처럼 PORT가 없으면
# 8000으로 폴백한다.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
