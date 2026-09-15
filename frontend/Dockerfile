# 빌드 컨텍스트는 frontend/ 디렉터리 (docker-compose.yml 참고). 직접 빌드할 땐:
#   docker build -f frontend/Dockerfile -t ow-frontend \
#     --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com frontend
#
# NEXT_PUBLIC_* 환경변수는 Next.js가 빌드 타임에 코드에 그대로 박아 넣는 값이라,
# 런타임 환경변수로 넘겨봐야 반영되지 않는다 — 반드시 빌드 시점에 --build-arg로
# 넘겨야 한다.

FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
