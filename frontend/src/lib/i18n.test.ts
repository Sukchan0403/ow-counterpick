import { describe, expect, it } from "vitest";
import {
  ARCHETYPE_CATEGORY_LABEL,
  archetypeCategoryLabel,
  DICTIONARIES,
  getDictionary,
  LOCALES,
  MODE_LABEL,
  modeLabel,
  RICHNESS_LABEL,
  ROLE_LABEL,
  type Locale,
} from "./i18n";

describe("getDictionary", () => {
  it("returns the matching dictionary for every locale", () => {
    for (const locale of LOCALES) {
      expect(getDictionary(locale)).toBe(DICTIONARIES[locale]);
    }
  });
});

describe("modeLabel", () => {
  it("translates a known mode per locale", () => {
    expect(modeLabel("ko", "hybrid")).toBe("혼합");
    expect(modeLabel("en", "hybrid")).toBe("Hybrid");
    expect(modeLabel("zh-cn", "hybrid")).toBe("混合");
  });

  it("falls back to the raw mode string when unknown", () => {
    expect(modeLabel("ko", "totally_new_mode")).toBe("totally_new_mode");
  });
});

describe("archetypeCategoryLabel", () => {
  it("translates a known category per locale", () => {
    expect(archetypeCategoryLabel("ko", "개시자")).toBe("개시자");
    expect(archetypeCategoryLabel("en", "개시자")).toBe("Vanguard");
    expect(archetypeCategoryLabel("ja", "의무관")).toBe("衛生兵");
  });

  it("falls back to the raw category value when unknown", () => {
    expect(archetypeCategoryLabel("en", "존재하지않는카테고리")).toBe("존재하지않는카테고리");
  });
});

describe("locale coverage", () => {
  // heroes.archetype_category처럼 백엔드가 언어와 무관하게 한국어 키를 그대로
  // 내려주는 값들은, 신규 로케일을 추가할 때 이 표들 중 하나를 빠뜨리기 쉽다.
  // TypeScript의 Record<Locale, ...> 타입이 컴파일 타임에 이미 강제하긴 하지만,
  // 런타임에서도 한 번 더 확인해 회귀를 잡는다.
  it("every locale has a role/mode/richness label table", () => {
    for (const locale of LOCALES as Locale[]) {
      expect(Object.keys(ROLE_LABEL[locale]).length).toBeGreaterThan(0);
      expect(Object.keys(MODE_LABEL[locale]).length).toBeGreaterThan(0);
      expect(Object.keys(RICHNESS_LABEL[locale]).length).toBeGreaterThan(0);
      expect(Object.keys(ARCHETYPE_CATEGORY_LABEL[locale]).length).toBeGreaterThan(0);
    }
  });

  it("every locale defines the exact same set of archetype-category keys", () => {
    const [first, ...rest] = LOCALES.map((l) => Object.keys(ARCHETYPE_CATEGORY_LABEL[l]).sort());
    for (const keys of rest) {
      expect(keys).toEqual(first);
    }
  });
});
