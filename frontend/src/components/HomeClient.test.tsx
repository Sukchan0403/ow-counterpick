import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Hero, MapInfo, RecommendationResponse } from "@/lib/types";
import { getDictionary } from "@/lib/i18n";
import { ApiValidationError, ApiServerError } from "@/lib/api";
import { HomeClient } from "./HomeClient";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    fetchHeroes: vi.fn(),
    fetchMaps: vi.fn(),
    fetchMeta: vi.fn(),
    postRecommendations: vi.fn(),
  };
});

import { fetchHeroes, fetchMaps, fetchMeta, postRecommendations } from "@/lib/api";

const t = getDictionary("en");

const HEROES: Hero[] = [
  { id: "tank1", name: "Tank1", role: "tank", archetype: "", icon_url: "", archetype_category: "개시자" },
  { id: "tank2", name: "Tank2", role: "tank", archetype: "", icon_url: "", archetype_category: "개시자" },
  { id: "dps1", name: "Dps1", role: "damage", archetype: "", icon_url: "", archetype_category: "명사수" },
  { id: "dps2", name: "Dps2", role: "damage", archetype: "", icon_url: "", archetype_category: "명사수" },
  { id: "dps3", name: "Dps3", role: "damage", archetype: "", icon_url: "", archetype_category: "명사수" },
  { id: "sup1", name: "Sup1", role: "support", archetype: "", icon_url: "", archetype_category: "전술가" },
  { id: "sup2", name: "Sup2", role: "support", archetype: "", icon_url: "", archetype_category: "전술가" },
  { id: "sup3", name: "Sup3", role: "support", archetype: "", icon_url: "", archetype_category: "전술가" },
];

const MAPS: MapInfo[] = [
  { id: "eichenwalde", name: "Eichenwalde", mode: "hybrid", image_url: "", data_richness: "rich" },
];

function defaultResult(): RecommendationResponse {
  return {
    recommendations: [
      {
        hero_id: "sup1",
        hero_name: "Sup1",
        role: "support",
        archetype: "",
        icon_url: "",
        archetype_category: "전술가",
        total_score: 60,
        percentage: 88,
        score_breakdown: { counter: 60, synergy: 0, map: 0 },
        reasons: ["reason"],
        is_must_pick: false,
        notes: [],
        data_gaps: [],
      },
    ],
    empty_position: "support",
    notice: null,
  };
}

beforeEach(() => {
  vi.mocked(fetchHeroes).mockReset().mockResolvedValue(HEROES);
  vi.mocked(fetchMaps).mockReset().mockResolvedValue(MAPS);
  vi.mocked(fetchMeta).mockReset().mockResolvedValue({ season: "Season 4", data_version: "v0.3" });
  vi.mocked(postRecommendations).mockReset().mockResolvedValue(defaultResult());
});

async function pickEnemyTeam(user: ReturnType<typeof userEvent.setup>) {
  // enemy team is the default active team; role limits are tank1/damage2/support2 (5 total)
  for (const name of ["Tank1", "Dps1", "Dps2", "Sup1", "Sup2"]) {
    await user.click(screen.getByText(name));
  }
}

async function pickOurTeam(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: new RegExp(`^${t.ourTeam}`) }));
  // tank1/damage2/support2 role limits, our team size 4: 1 tank + 2 damage + 1 support.
  // Dps1 is also picked for the enemy team — mirror picks are allowed.
  for (const name of ["Tank2", "Dps3", "Dps1", "Sup3"]) {
    await user.click(screen.getByText(name));
  }
}

async function pickMap(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText(t.mapPlaceholder));
  await user.click(await screen.findByText("Eichenwalde"));
}

describe("HomeClient", () => {
  it("shows the loading note, then the picker UI once the catalog loads", async () => {
    render(<HomeClient locale="en" />);
    expect(screen.getByText(t.loading)).toBeInTheDocument();

    expect(await screen.findByText("Tank1")).toBeInTheDocument();
  });

  it("shows the error screen if the catalog fails to load, and retries on click", async () => {
    vi.mocked(fetchHeroes).mockRejectedValueOnce(new ApiServerError("network down"));
    const user = userEvent.setup();
    render(<HomeClient locale="en" />);

    expect(await screen.findByText(t.errorHeading)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: t.retry }));
    expect(await screen.findByText("Tank1")).toBeInTheDocument();
  });

  it("still shows the picker UI (without the meta badge) if only fetchMeta fails", async () => {
    vi.mocked(fetchMeta).mockRejectedValueOnce(new Error("meta down"));
    render(<HomeClient locale="en" />);

    expect(await screen.findByText("Tank1")).toBeInTheDocument();
    expect(screen.queryByText(/Season 4/)).not.toBeInTheDocument();
  });

  it("auto-submits once enemy(5) + our(4) teams and a map are all selected, with no submit button", async () => {
    const user = userEvent.setup();
    render(<HomeClient locale="en" />);
    await screen.findByText("Tank1");

    await pickEnemyTeam(user);
    await pickOurTeam(user);
    await pickMap(user);

    await waitFor(() => expect(postRecommendations).toHaveBeenCalledTimes(1));
    expect(postRecommendations).toHaveBeenCalledWith(
      expect.objectContaining({
        enemy_heroes: expect.arrayContaining(["tank1", "dps1", "dps2", "sup1", "sup2"]),
        our_heroes: expect.arrayContaining(["tank2", "dps3", "dps1", "sup3"]),
        map_id: "eichenwalde",
      }),
      "en",
    );
    expect(await screen.findByText(t.recommendationScore(88))).toBeInTheDocument();
  });

  it("shows a validation message (not the full error screen) on ApiValidationError, and does not re-submit the same input", async () => {
    vi.mocked(postRecommendations).mockRejectedValueOnce(new ApiValidationError("bad input"));
    const user = userEvent.setup();
    render(<HomeClient locale="en" />);
    await screen.findByText("Tank1");

    await pickEnemyTeam(user);
    await pickOurTeam(user);
    await pickMap(user);

    expect(await screen.findByText("bad input")).toBeInTheDocument();
    // Still on the picker screen, not the full-page error screen.
    expect(screen.queryByText(t.errorHeading)).not.toBeInTheDocument();

    // Re-render tick without changing any input: must not fire a second request.
    await new Promise((r) => setTimeout(r, 10));
    expect(postRecommendations).toHaveBeenCalledTimes(1);
  });

  it("shows the full error screen on a generic ApiServerError, and retry re-submits", async () => {
    vi.mocked(postRecommendations).mockRejectedValueOnce(new ApiServerError("boom"));
    const user = userEvent.setup();
    render(<HomeClient locale="en" />);
    await screen.findByText("Tank1");

    await pickEnemyTeam(user);
    await pickOurTeam(user);
    await pickMap(user);

    expect(await screen.findByText(t.errorHeading)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: t.retry }));
    await waitFor(() => expect(postRecommendations).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(t.recommendationScore(88))).toBeInTheDocument();
  });

  it("returns to the picker screen when 'back to input' is clicked after a successful result", async () => {
    const user = userEvent.setup();
    render(<HomeClient locale="en" />);
    await screen.findByText("Tank1");

    await pickEnemyTeam(user);
    await pickOurTeam(user);
    await pickMap(user);
    await screen.findByText(t.recommendationScore(88));

    await user.click(screen.getByRole("button", { name: t.backToInput }));

    expect(screen.getByText("Tank1")).toBeInTheDocument();
  });
});
