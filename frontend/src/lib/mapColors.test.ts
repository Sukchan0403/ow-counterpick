import { describe, expect, it } from "vitest";
import { colorForMap, MAP_COLORS } from "./mapColors";

describe("colorForMap", () => {
  it("returns the exact configured color for a known map id", () => {
    expect(colorForMap("eichenwalde")).toBe(MAP_COLORS.eichenwalde);
    expect(colorForMap("oasis")).toBe(MAP_COLORS.oasis);
  });

  it("returns a deterministic fallback color for an unknown map id", () => {
    const first = colorForMap("some_brand_new_map");
    const second = colorForMap("some_brand_new_map");
    expect(first).toBe(second);
    expect(first).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("can produce different fallback colors for different unknown ids", () => {
    // Not guaranteed for every pair (hash collisions are possible), but these two
    // are known to hash to different buckets given FALLBACK_COLORS.length === 4.
    expect(colorForMap("a")).not.toBe(colorForMap("bb"));
  });
});
