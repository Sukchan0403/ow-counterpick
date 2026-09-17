import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LOCALE_LABEL, LOCALES } from "@/lib/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";

describe("LanguageSwitcher", () => {
  it("renders a link for every supported locale with the correct label and href", () => {
    render(<LanguageSwitcher locale="ko" />);

    const expectedHrefs: Record<string, string> = {
      ko: "/", en: "/en", ja: "/ja", "zh-cn": "/zh-cn", "zh-tw": "/zh-tw",
    };
    for (const locale of LOCALES) {
      const link = screen.getByRole("link", { name: LOCALE_LABEL[locale] });
      expect(link).toHaveAttribute("href", expectedHrefs[locale]);
    }
  });

  it("marks only the current locale's link as active/aria-current", () => {
    render(<LanguageSwitcher locale="ja" />);

    const jaLink = screen.getByRole("link", { name: LOCALE_LABEL.ja });
    expect(jaLink).toHaveAttribute("aria-current", "true");

    const koLink = screen.getByRole("link", { name: LOCALE_LABEL.ko });
    expect(koLink).not.toHaveAttribute("aria-current");
  });
});
