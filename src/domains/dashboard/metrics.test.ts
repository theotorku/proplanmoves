import { describe, expect, it } from "vitest";
import {
  calculateConversionRates,
  formatCents,
  formatPercent,
  percentage,
  reportingWindowStart
} from "./metrics";

describe("percentage", () => {
  it("rounds to one decimal place", () => {
    expect(percentage(1, 3)).toBe(33.3);
    expect(percentage(2, 3)).toBe(66.7);
    expect(percentage(1, 2)).toBe(50);
  });

  it("returns null when nothing has happened yet", () => {
    expect(percentage(0, 0)).toBeNull();
    expect(percentage(5, 0)).toBeNull();
  });

  it("does not invent a rate from bad input", () => {
    expect(percentage(Number.NaN, 10)).toBeNull();
    expect(percentage(1, Number.POSITIVE_INFINITY)).toBeNull();
    expect(percentage(1, -4)).toBeNull();
  });

  it("reports a real zero when the denominator is real", () => {
    expect(percentage(0, 12)).toBe(0);
  });
});

describe("calculateConversionRates", () => {
  it("derives both funnel rates", () => {
    expect(
      calculateConversionRates({
        leadsCreated: 40,
        leadsWon: 10,
        quotesSent: 16,
        quotesAccepted: 10
      })
    ).toEqual({ leadToWonPercent: 25, quoteAcceptancePercent: 62.5 });
  });

  it("keeps a quiet period distinguishable from a bad one", () => {
    expect(
      calculateConversionRates({
        leadsCreated: 0,
        leadsWon: 0,
        quotesSent: 0,
        quotesAccepted: 0
      })
    ).toEqual({ leadToWonPercent: null, quoteAcceptancePercent: null });
  });
});

describe("formatting", () => {
  it("renders an unknown rate as an em dash", () => {
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(62.5)).toBe("62.5%");
  });

  it("renders money in whole dollars", () => {
    expect(formatCents(103100)).toBe("$1,031");
    expect(formatCents(0)).toBe("$0");
  });
});

describe("reportingWindowStart", () => {
  it("looks back a whole number of days", () => {
    expect(reportingWindowStart("2026-08-13")).toBe("2026-07-14");
    expect(reportingWindowStart("2026-08-13", 7)).toBe("2026-08-06");
  });

  it("crosses month and year boundaries", () => {
    expect(reportingWindowStart("2026-01-05", 30)).toBe("2025-12-06");
    expect(reportingWindowStart("2026-03-01", 1)).toBe("2026-02-28");
  });
});
