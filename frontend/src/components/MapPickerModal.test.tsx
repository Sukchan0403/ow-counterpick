import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MapInfo } from "@/lib/types";
import { getDictionary } from "@/lib/i18n";
import { MapPickerModal } from "./MapPickerModal";

const t = getDictionary("en");

const MAPS: MapInfo[] = [
  { id: "eichenwalde", name: "Eichenwalde", mode: "hybrid", image_url: "", data_richness: "rich" },
  { id: "kings_row", name: "King's Row", mode: "hybrid", image_url: "", data_richness: "growing" },
  { id: "ilios", name: "Ilios", mode: "control", image_url: "", data_richness: "rich" },
];

function setup(overrides: Partial<React.ComponentProps<typeof MapPickerModal>> = {}) {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  const { container } = render(
    <MapPickerModal
      maps={MAPS}
      selectedId={null}
      onSelect={onSelect}
      onClose={onClose}
      locale="en"
      {...overrides}
    />,
  );
  return { onSelect, onClose, backdrop: container.firstElementChild as HTMLElement };
}

describe("MapPickerModal", () => {
  it("groups maps by mode and shows every map name", () => {
    setup();
    expect(screen.getByText("Eichenwalde")).toBeInTheDocument();
    expect(screen.getByText("King's Row")).toBeInTheDocument();
    expect(screen.getByText("Ilios")).toBeInTheDocument();
  });

  it("marks a mode group as growing if any map in it lacks rich data (conservative)", () => {
    setup();
    // hybrid 그룹은 eichenwalde(rich) + kings_row(growing) 혼합 -> growing 표시
    const hybridHeader = screen.getByText(t.mapCount(2), { exact: false }).parentElement;
    expect(hybridHeader?.textContent).toContain("Data growing");
  });

  it("marks a mode group as rich only when every map in it is rich", () => {
    setup();
    const controlHeader = screen.getByText(t.mapCount(1), { exact: false }).parentElement;
    expect(controlHeader?.textContent).toContain("Rich data");
  });

  it("calls onSelect with the map id and onClose when a map card is clicked", async () => {
    const user = userEvent.setup();
    const { onSelect, onClose } = setup();

    await user.click(screen.getByText("Ilios"));

    expect(onSelect).toHaveBeenCalledWith("ilios");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    const { onClose } = setup();

    await user.click(screen.getByRole("button", { name: t.close }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop (outside the modal) is clicked", async () => {
    const user = userEvent.setup();
    const { onClose, backdrop } = setup();

    await user.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when clicking inside the modal itself (stopPropagation)", async () => {
    const user = userEvent.setup();
    const { onClose } = setup();

    await user.click(screen.getByText(t.mapPickerTitle));

    expect(onClose).not.toHaveBeenCalled();
  });
});
