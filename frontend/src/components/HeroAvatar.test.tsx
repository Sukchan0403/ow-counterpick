import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeroAvatar } from "./HeroAvatar";

// alt=""인 <img>는 접근성 트리에서 role="img"가 아니라 presentation으로 취급되므로,
// getByRole 대신 querySelector로 직접 찾는다.
describe("HeroAvatar", () => {
  it("renders an <img> when iconUrl is set", () => {
    const { container } = render(
      <HeroAvatar iconUrl="https://example.com/icon.png" name="라인하르트" variant="icon" />,
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://example.com/icon.png",
    );
  });

  it("falls back to the first letter of the name when iconUrl is empty", () => {
    const { container } = render(<HeroAvatar iconUrl="" name="라인하르트" variant="icon" />);
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText("라")).toBeInTheDocument();
  });

  it("falls back to '?' when the name is an empty string", () => {
    render(<HeroAvatar iconUrl="" name="" variant="portrait" />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("switches to the letter fallback if the image fails to load (onError)", () => {
    const { container } = render(
      <HeroAvatar iconUrl="https://example.com/broken.png" name="겐지" variant="portrait" />,
    );
    const img = container.querySelector("img")!;

    fireEvent.error(img);

    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText("겐")).toBeInTheDocument();
  });

  it("sets loading=lazy by default and omits it when lazy=false", () => {
    const { container, rerender } = render(
      <HeroAvatar iconUrl="https://example.com/icon.png" name="아나" variant="icon" />,
    );
    expect(container.querySelector("img")).toHaveAttribute("loading", "lazy");

    rerender(
      <HeroAvatar iconUrl="https://example.com/icon.png" name="아나" variant="icon" lazy={false} />,
    );
    expect(container.querySelector("img")).not.toHaveAttribute("loading");
  });
});
