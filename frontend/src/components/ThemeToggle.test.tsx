import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n";
import { ThemeToggle } from "./ThemeToggle";

const t = getDictionary("en");

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  localStorage.clear();
});

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  localStorage.clear();
});

describe("ThemeToggle", () => {
  it("starts in dark mode when no data-theme attribute is set", () => {
    render(<ThemeToggle locale="en" />);
    expect(screen.getByRole("button", { name: t.switchToLight })).toBeInTheDocument();
  });

  it("syncs to light mode if layout.tsx's inline script already set data-theme=light", () => {
    document.documentElement.setAttribute("data-theme", "light");
    render(<ThemeToggle locale="en" />);
    expect(screen.getByRole("button", { name: t.switchToDark })).toBeInTheDocument();
  });

  it("toggles theme, updates the DOM attribute, and persists to localStorage", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle locale="en" />);

    await user.click(screen.getByRole("button", { name: t.switchToLight }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem("theme")).toBe("light");
    expect(screen.getByRole("button", { name: t.switchToDark })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: t.switchToDark }));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(screen.getByRole("button", { name: t.switchToLight })).toBeInTheDocument();
  });
});
