/**
 * Pure KPI arithmetic. Every rate here can be asked for with an empty
 * denominator on a quiet week, so each one has a defined answer rather than a
 * NaN rendered into the page.
 */

export type ConversionInput = {
  leadsCreated: number;
  leadsWon: number;
  quotesSent: number;
  quotesAccepted: number;
};

export type ConversionRates = {
  leadToWonPercent: number | null;
  quoteAcceptancePercent: number | null;
};

export function calculateConversionRates(input: ConversionInput): ConversionRates {
  return {
    leadToWonPercent: percentage(input.leadsWon, input.leadsCreated),
    quoteAcceptancePercent: percentage(input.quotesAccepted, input.quotesSent)
  };
}

/**
 * Returns null rather than 0 when nothing has happened yet: "no quotes were
 * sent" and "no quotes were accepted" are different facts, and a dashboard
 * that shows 0% for both invites the wrong conclusion.
 */
export function percentage(part: number, whole: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) {
    return null;
  }

  return Math.round((part / whole) * 1000) / 10;
}

export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(cents / 100);
}

/** The window every "last 30 days" figure is measured over. */
export function reportingWindowStart(today: string, days = 30): string {
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days);
  return start.toISOString().slice(0, 10);
}
