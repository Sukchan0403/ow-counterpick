import type { Hero, MapInfo, MetaInfo, RecommendationRequest, RecommendationResponse } from "./types";

// 로컬 개발 시 백엔드는 기본적으로 http://127.0.0.1:8000 에서 uvicorn으로 띄운다고 가정.
// 배포 시엔 .env.local 등에 NEXT_PUBLIC_API_BASE_URL을 다른 값으로 넣으면 됨.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export class ApiValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiValidationError";
  }
}

// 스펙의 "백엔드 오류 -> 502 + 재시도" 화면(BackendError)으로 이어지는 에러.
// 실제 502 응답뿐 아니라 네트워크 자체가 끊긴 경우(fetch 실패)도 여기로 묶는다 —
// 사용자 입장에서 "서버가 응답을 안 준다"는 같은 상황이기 때문.
export class ApiServerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiServerError";
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) {
    return (await res.json()) as T;
  }
  if (res.status === 400 || res.status === 422) {
    let detail = "입력값을 확인해주세요.";
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      // ignore parse error, use default message
    }
    throw new ApiValidationError(detail);
  }
  throw new ApiServerError(`서버 오류 (status ${res.status})`);
}

export async function fetchHeroes(): Promise<Hero[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/heroes`);
    return await handleResponse<Hero[]>(res);
  } catch (err) {
    if (err instanceof ApiValidationError || err instanceof ApiServerError) throw err;
    throw new ApiServerError("영웅 목록을 불러오지 못했어요.");
  }
}

export async function fetchMaps(): Promise<MapInfo[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/maps`);
    return await handleResponse<MapInfo[]>(res);
  } catch (err) {
    if (err instanceof ApiValidationError || err instanceof ApiServerError) throw err;
    throw new ApiServerError("맵 목록을 불러오지 못했어요.");
  }
}

// 헤더의 "시즌 4 시드 데이터 · v0.3" 배지용. 핵심 기능이 아니므로 실패해도
// 화면 전체를 에러 상태로 빠뜨리지 않고 그냥 배지를 안 보여주면 됨 — 호출부(page.tsx)에서 처리.
export async function fetchMeta(): Promise<MetaInfo> {
  const res = await fetch(`${API_BASE_URL}/api/meta`);
  return await handleResponse<MetaInfo>(res);
}

export async function postRecommendations(
  payload: RecommendationRequest,
): Promise<RecommendationResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await handleResponse<RecommendationResponse>(res);
  } catch (err) {
    if (err instanceof ApiValidationError || err instanceof ApiServerError) throw err;
    throw new ApiServerError("추천 결과를 받아오지 못했어요.");
  }
}
