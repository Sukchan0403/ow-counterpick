import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "@/lib/i18n";
import { ErrorScreen } from "./ErrorScreen";

describe("ErrorScreen", () => {
  it("renders the localized heading/subtext/retry text for the given locale", () => {
    const t = getDictionary("en");
    render(<ErrorScreen locale="en" onRetry={() => {}} />);
    expect(screen.getByText(t.errorHeading)).toBeInTheDocument();
    expect(screen.getByText(t.errorSubtext)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.retry })).toBeInTheDocument();
  });

  it("calls onRetry when the retry button is clicked", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorScreen locale="ko" onRetry={onRetry} />);

    await user.click(screen.getByRole("button", { name: getDictionary("ko").retry }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
