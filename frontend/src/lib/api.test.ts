import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "./i18n";
import { ApiServerError, fetchHeroes, fetchMeta, postRecommendations } from "./api";

const t = getDictionary("ko");

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchHeroes", () => {
  it("requests the given locale via the lang query param and returns parsed JSON", async () => {
    const heroes = [{ id: "dva", name: "디바" }];
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(heroes));

    const result = await fetchHeroes("en");

    expect(result).toEqual(heroes);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/heroes?lang=en"));
  });

  it("throws ApiValidationError with the backend's detail message on 400", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ detail: "알 수 없는 영웅입니다: nope" }, 400),
    );

    await expect(fetchHeroes("ko")).rejects.toMatchObject({
      name: "ApiValidationError",
      message: "알 수 없는 영웅입니다: nope",
    });
  });

  it("falls back to the localized generic message when the 422 body has no string detail", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}, 422));

    await expect(fetchHeroes("ko")).rejects.toMatchObject({ message: t.apiInvalidInput });
  });

  it("throws ApiServerError with the status code on a 502", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ detail: "..." }, 502));

    await expect(fetchHeroes("ko")).rejects.toMatchObject({
      name: "ApiServerError",
      message: t.apiServerErrorStatus(502),
    });
  });

  it("wraps a network failure (fetch rejecting) in a localized ApiServerError", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(fetchHeroes("ko")).rejects.toMatchObject({
      name: "ApiServerError",
      message: t.apiHeroesLoadFailed,
    });
  });
});

describe("postRecommendations", () => {
  it("POSTs the payload with the locale merged in as `lang`", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ recommendations: [], empty_position: "support", notice: null }),
    );

    await postRecommendations(
      { enemy_heroes: [], our_heroes: [], map_id: "eichenwalde" },
      "en",
    );

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/recommendations"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          enemy_heroes: [],
          our_heroes: [],
          map_id: "eichenwalde",
          lang: "en",
        }),
      }),
    );
  });
});

describe("fetchMeta", () => {
  // fetchMeta는 다른 함수들과 달리 fetch() 자체를 try/catch로 감싸지 않는다
  // (호출부가 실패를 조용히 무시하도록 설계됨 — api.ts의 주석 참고). 그래서
  // 네트워크 실패 시 ApiServerError가 아니라 원본 에러가 그대로 올라온다.
  it("propagates the raw fetch error on network failure, unlike the other api.ts functions", async () => {
    const networkError = new TypeError("Failed to fetch");
    vi.mocked(fetch).mockRejectedValueOnce(networkError);

    await expect(fetchMeta("ko")).rejects.toBe(networkError);
  });

  it("still throws ApiServerError for a non-ok HTTP response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}, 502));

    await expect(fetchMeta("ko")).rejects.toThrow(ApiServerError);
  });
});
