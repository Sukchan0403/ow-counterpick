import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Hero } from "@/lib/types";
import { getDictionary } from "@/lib/i18n";
import { SharedHeroGrid, type Team } from "./SharedHeroGrid";

const t = getDictionary("en");

const HEROES: Hero[] = [
  { id: "reinhardt", name: "Reinhardt", role: "tank", archetype: "", icon_url: "", archetype_category: "강건한 자" },
  { id: "winston", name: "Winston", role: "tank", archetype: "", icon_url: "", archetype_category: "개시자" },
  { id: "some_new_tank", name: "NewTank", role: "tank", archetype: "", icon_url: "", archetype_category: "아직 없는 카테고리" },
  { id: "genji", name: "Genji", role: "damage", archetype: "", icon_url: "", archetype_category: "측면 공격가" },
  { id: "ana", name: "Ana", role: "support", archetype: "", icon_url: "", archetype_category: "전술가" },
];

function setup(overrides: Partial<React.ComponentProps<typeof SharedHeroGrid>> = {}) {
  const onChangeActiveTeam = vi.fn();
  const onChangeEnemy = vi.fn();
  const onChangeOur = vi.fn();
  const props = {
    heroes: HEROES,
    activeTeam: "enemy" as Team,
    onChangeActiveTeam,
    enemyIds: [] as string[],
    ourIds: [] as string[],
    enemyMax: 5,
    ourMax: 4,
    onChangeEnemy,
    onChangeOur,
    locale: "en" as const,
    ...overrides,
  };
  render(<SharedHeroGrid {...props} />);
  return { onChangeActiveTeam, onChangeEnemy, onChangeOur };
}

describe("SharedHeroGrid", () => {
  it("adds a hero to the enemy team when active team is enemy and the hero is clicked", async () => {
    const user = userEvent.setup();
    const { onChangeEnemy, onChangeOur } = setup({ activeTeam: "enemy" });

    await user.click(screen.getByText("Genji"));

    expect(onChangeEnemy).toHaveBeenCalledWith(["genji"]);
    expect(onChangeOur).not.toHaveBeenCalled();
  });

  it("adds a hero to our team when active team is our", async () => {
    const user = userEvent.setup();
    const { onChangeOur } = setup({ activeTeam: "our" });

    await user.click(screen.getByText("Genji"));

    expect(onChangeOur).toHaveBeenCalledWith(["genji"]);
  });

  it("removes an already-selected hero on click (toggle off), even at max", async () => {
    const user = userEvent.setup();
    const { onChangeEnemy } = setup({
      activeTeam: "enemy",
      enemyIds: ["genji"],
      enemyMax: 1, // already at max
    });

    await user.click(screen.getByText("Genji"));

    expect(onChangeEnemy).toHaveBeenCalledWith([]);
  });

  it("disables (and does not add) new heroes once the active team's max count is reached", async () => {
    const user = userEvent.setup();
    const { onChangeEnemy } = setup({
      activeTeam: "enemy",
      enemyIds: ["genji"],
      enemyMax: 1,
    });

    const anaButton = screen.getByText("Ana").closest("button")!;
    expect(anaButton).toBeDisabled();

    await user.click(anaButton);
    expect(onChangeEnemy).not.toHaveBeenCalled();
  });

  it("disables adding a hero once that hero's role limit is reached", async () => {
    const user = userEvent.setup();
    const { onChangeEnemy } = setup({
      activeTeam: "enemy",
      enemyIds: ["reinhardt"],
      enemyMax: 5,
      roleLimits: { tank: 1 },
    });

    // Winston is also a tank; the tank role is already at its limit (1), even
    // though the overall team isn't full yet.
    const winstonButton = screen.getByText("Winston").closest("button")!;
    expect(winstonButton).toBeDisabled();

    await user.click(winstonButton);
    expect(onChangeEnemy).not.toHaveBeenCalled();

    // A support hero should remain selectable since only the tank role is capped.
    await user.click(screen.getByText("Ana"));
    expect(onChangeEnemy).toHaveBeenCalledWith(["reinhardt", "ana"]);
  });

  it("shows both team markers for a mirror-picked hero (on both enemy and our team)", () => {
    setup({ enemyIds: ["genji"], ourIds: ["genji"] });

    const genjiButton = screen.getByText("Genji").closest("button")!;
    expect(genjiButton.querySelectorAll("span").length).toBeGreaterThanOrEqual(2);
  });

  it("buckets a hero whose archetype_category is unknown into the uncategorized group", () => {
    setup();
    expect(screen.getByText(t.uncategorized)).toBeInTheDocument();
    expect(screen.getByText("NewTank")).toBeInTheDocument();
  });

  it("switches the active team when a team toggle button is clicked", async () => {
    const user = userEvent.setup();
    const { onChangeActiveTeam } = setup({ activeTeam: "enemy" });

    await user.click(screen.getByRole("button", { name: new RegExp(`^${t.ourTeam}`) }));

    expect(onChangeActiveTeam).toHaveBeenCalledWith("our");
  });
});
