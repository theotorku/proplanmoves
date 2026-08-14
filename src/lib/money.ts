const exact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});

const whole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

/**
 * Money lives in integer cents (ADR-005); this is the only place it becomes a
 * string. It deliberately sits outside any "use client" module so server
 * components can call it — a formatter exported from a client module is a
 * client reference and throws when the server renders with it.
 */
export function formatCents(cents: number, options: { whole?: boolean } = {}): string {
  return (options.whole ? whole : exact).format(cents / 100);
}
