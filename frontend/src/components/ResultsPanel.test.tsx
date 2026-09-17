import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { HeroRecommendation } from "@/lib/types";
import { getDictionary } from "@/lib/i18n";
import { ResultsPanel } from "./ResultsPanel";

const t = getDictionary("en");

function rec(overrides: Partial<HeroRecommendation> = {}): HeroRecommendation {
  return {
    hero_id: "kiriko",
    hero_name: "Kiriko",
    role: "support",
    archetype: "Recon Support",
    icon_url: "",
    archetype_category: "전술가",
    total_score: 60,
    percentage: 88,
    score_breakdown: { counter: 60, synergy: 0, map: 0 },
    reasons: ["Cleanses enemy CC ults"],
    is_must_pick: false,
    notes: [],
    data_gaps: [],
    ...overrides,
  };
}

describe("ResultsPanel", () => {
  it("shows the inferred/selected empty position", () => {
    render(
      <ResultsPanel recommendations={[rec()]} emptyPosition="support" notice={null} locale="en" />,
    );
    expect(screen.getByText("Support")).toBeInTheDocument();
  });

  it("shows the notice banner only when notice is non-null", () => {
    const { rerender } = render(
      <ResultsPanel recommendations={[rec()]} emptyPosition="support" notice={null} locale="en" />,
    );
    expect(screen.queryByText(/limited/i)).not.toBeInTheDocument();

    rerender(
      <ResultsPanel
        recommendations={[rec()]}
        emptyPosition="support"
        notice="Recommendations are limited"
        locale="en"
      />,
    );
    expect(screen.getByText("Recommendations are limited")).toBeInTheDocument();
  });

  it("renders each recommendation's name, score, and reasons", () => {
    render(
      <ResultsPanel
        recommendations={[rec({ reasons: ["Cleanses enemy CC ults", "Fast repositioning"] })]}
        emptyPosition="support"
        notice={null}
        locale="en"
      />,
    );
    expect(screen.getByText("Kiriko")).toBeInTheDocument();
    expect(screen.getByText(t.recommendationScore(88))).toBeInTheDocument();
    expect(screen.getByText("Cleanses enemy CC ults")).toBeInTheDocument();
    expect(screen.getByText("Fast repositioning")).toBeInTheDocument();
  });

  it("only shows the must-pick badge when is_must_pick is true", () => {
    const { rerender } = render(
      <ResultsPanel
        recommendations={[rec({ is_must_pick: false })]}
        emptyPosition="support"
        notice={null}
        locale="en"
      />,
    );
    expect(screen.queryByText(t.mustPickBadge)).not.toBeInTheDocument();

    rerender(
      <ResultsPanel
        recommendations={[rec({ is_must_pick: true })]}
        emptyPosition="support"
        notice={null}
        locale="en"
      />,
    );
    expect(screen.getByText(t.mustPickBadge)).toBeInTheDocument();
  });

  it("prefixes data_gaps entries with the 'no data' label", () => {
    render(
      <ResultsPanel
        recommendations={[rec({ data_gaps: ["Matchup vs. Reaper not yet reviewed"] })]}
        emptyPosition="support"
        notice={null}
        locale="en"
      />,
    );
    expect(
      screen.getByText(`${t.noDataPrefix}Matchup vs. Reaper not yet reviewed`),
    ).toBeInTheDocument();
  });

  it("treats a negative counter score (candidate is countered) as zero width in the breakdown bar", () => {
    const { container } = render(
      <ResultsPanel
        recommendations={[
          rec({ score_breakdown: { counter: -60, synergy: 10, map: 0 }, total_score: -50 }),
        ]}
        emptyPosition="support"
        notice={null}
        locale="en"
      />,
    );
    // total = max(-60,0) + 10 + max(0,0) = 10 -> synergy should be 100% of the bar,
    // and no bar segment should carry the blue (counter) color.
    const segments = Array.from(container.querySelectorAll('[class*="breakdownBar"] > div'));
    const blueSegment = segments.find((el) => (el as HTMLElement).style.background === "var(--blue)");
    expect(blueSegment).toBeUndefined();
  });
});
