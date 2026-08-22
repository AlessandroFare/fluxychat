import { describe, expect, it } from "vitest";
import {
  formatMoney,
  inferAnalyticsCurrency,
  isAnalyticsCurrency,
  roundMoney,
} from "./format-number";

describe("roundMoney", () => {
  it("collapses binary float noise", () => {
    expect(roundMoney(0.09999999999999999, 4)).toBe(0.1);
    expect(roundMoney(1 / 10, 2)).toBe(0.1);
  });
});

describe("formatMoney", () => {
  it("formats projected costs without a long tail", () => {
    expect(formatMoney(0.09999999999999999, "GBP", "en-GB")).toBe("£0.10");
  });

  it("keeps two decimals on totals", () => {
    expect(formatMoney(1.2, "USD", "en-US", { min: 2, max: 2 })).toBe("$1.20");
  });
});

describe("inferAnalyticsCurrency", () => {
  it("maps locales to a display currency", () => {
    expect(inferAnalyticsCurrency("en-GB")).toBe("GBP");
    expect(inferAnalyticsCurrency("it-IT")).toBe("EUR");
    expect(inferAnalyticsCurrency("en-US")).toBe("USD");
  });

  it("validates currency codes", () => {
    expect(isAnalyticsCurrency("EUR")).toBe(true);
    expect(isAnalyticsCurrency("JPY")).toBe(false);
  });
});
